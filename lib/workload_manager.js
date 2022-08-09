/**
 * @fileOverview This file contains classes and definitions for the workload manager. A WorkloadManager can be used to assign arbitrary tasks to a network of servers, without having to manually handle RAM and thread costs.
 * @warning This is a work in progress.
 * @note Having multiple instances of the WorkloadManager class running at the same time has not been tested.
 */

import * as lib from "/lib/lib.js";
import * as t from "/lib/testing.js";

/**
 * Allows specifying additional constraints on the execution of a task.
 * @note This is mostly unused at the moment, this might be a bit too convoluted because I don't think there are any use cases for anything besides the task benefiting from cores or not (and therefore being allowed to run on home or not). I wrote this because I was not quite sure if other servers beside Home can have multiple cores, but apparently not.
 */
export class ExecutionPolicy
{
    constructor()
    {
        this.forbidden_types = 0;
        this.strict_power_allocation = false; // Unimplemented, not sure if useful
        this.allow_split = false; // Unimplemented, not sure if useful
        this.pass_threads = false; // Pass the number of threads used to invoke the task to the underlying script
    }
}

/**
 * @classdesc A Task represents an operation that can be assigned to a {@link Node}.
 * @param {NS} ns
 * @param {string} script The script to run
 * @param {int} powerNeeded The amount of power with which to run the script. Running 100 tasks with a magnitude of 1 is equivalent to running 1 task with a magnitude of 100.
 * @param  {...any} args The arguments to pass to the script
 * @desc In most cases, powerNeeded is equivalent to the number of threads that should be used, the only exception being scripts that are allowed to run on home. This can be controlled by setting the Task's {@link ExecutionPolicy} forbidden_types property appropriately.
 * @prop {NS} ns The NetScript instance.
 * @prop {ExecutionPolicy} policy The policy to use when executing the task.
 * @prop {?string} script The script to run. Null if this is a {@link Batch}.
 * @prop {int} powerNeeded The amount of power needed to finish the task. This is updated every time the task is executed.
 * @prop {...any} args The arguments to pass to the script.
 * @see Batch
 */
export class Task
{
    constructor(ns, script, powerNeeded, ...args)
    {
        this.ns = ns;
        this.script = script;
        // This is the amount of power t
        this.powerNeeded = powerNeeded;
        this.args = args;
        if (script != null)
        {
            this.cost = ns.getScriptRam(script);
        }
        else
        {
            this.cost = 0;
        }
    }

    print()
    {
        return `${this.script} ${this.powerNeeded} ${this.args} (${this.cost}MB)`;
    }
}

/**
 * A Batch is simply a collection of {@link Task}s that can be assigned at the same time.
 * This is mostly for convenience and adding a layer of abstraction in cases where we have a lot of tasks to assign.
 * A Batch is also a Task, so it is possible to make Batches of Batches. Matryoshka?
 * Note that batching tasks does NOT mean that the tasks will be executed on the same node, nor that the tasks will be executed sequentially.
 * @param {NS} ns The NetScript instance
 * @param {Task[]} tasks The initial tasks to add to the batch. Further tasks need to be added using the {@link Batch.add} method.
 * @prop {tasks} tasks The tasks in the batch.
 * @augments Task
 */
export class Batch extends Task
{
    constructor(ns, tasks = [])
    {
        super(ns);
        this.tasks = tasks;
        this.cost = 0;
        this.powerNeeded = 0;
        for (let task of tasks)
        {
            this.cost += task.cost;
            this.powerNeeded += task.powerNeeded;
        }
    }

    /**
     * Adds a task to the batch. This will update the cost of the batch.
     * @param {Task} task
     */
    add(task)
    {
        this.tasks.push(task);
        this.cost += task.cost;
        this.powerNeeded += task.powerNeeded;
    }
}

/**
 * A Node represents a Host that is capable of running tasks.
 * It is usually used along with a @see WorkloadManager.
 * @extends lib.Host
 * @param {NS} ns The NetScript instance. Mandatory.
 */
export class Node extends lib.Host
{
    constructor(ns, name)
    {
        super(ns, name);
    }

    /**
     * @param {Task} task The task to assign to the node
     * @param {number} factor The number of time this task will be assigned to the node.
     * @returns {Promise<number>} The amount of power that was used to run the task
     */
    async run(task, factor = 1)
    {
        factor = Math.floor(factor / this.cpuCores);
        if (factor < 1)
        {
            return 0;
        }
        if (task.tasks != null) // batch
        {
            let pow = 0;
            for (let subtask of task.tasks)
            {
                pow += await this.run(subtask, factor);
            }
            return pow;
        }
        else
        {
            const args = [...task.args];
            if (task.policy !== undefined && task.policy.pass_threads === true)
                args.push(factor);
            let success = await t.prof(this.exec, this, task.script, factor, args, factor);
            if (!success)
            {
                ns.print(`Failed to run ${task.script} on ${this.name}`);
            }
        }
        return factor * this.cpuCores;
    }

    /**
     * Runs a task as many times as possible on the node, ignoring the remaining cost of the task.
     * @param {Task} task
     * @returns {Promise<number>} The amount of power that was used to run the task
     */
    async fill(task)
    {
        let concurrent = this.currentAvailableRam / task.cost;
        concurrent = Math.floor(concurrent);
        await this.run(task, concurrent);
        return concurrent * this.cpuCores;
    }

    /**
     * @param {Task} task
     * @returns The amount of power the node can potentially run the task with
     */
    satisfaction(task)
    {
        let concurrent = this.currentAvailableRam / task.cost;
        concurrent = Math.floor(concurrent) * this.cpuCores;
        if (concurrent > task.powerNeeded)
        {
            concurrent = task.powerNeeded;
        }
        return concurrent;
    }

    /**
     * @param {ExecutionPolicy} policy
     * @returns Whether the Node satisfies the constraints of the policy
     * @see ExecutionPolicy
     */
    matchesPolicy(policy)
    {
        if (policy == null)
        {
            return true;
        }
        if (policy.forbidden_types & this.type)
            return false;
        if (policy.names != null && !policy.names.includes(this.name))
            return false;
        return true;
    }
}

/**
 * The intended way to create a Node.
 * @returns {Node} A new Node instance
 */
export async function createNode(ns, name)
{
    let node = new Node(ns, name);
    await t.prof(node.update, node);
    return node;
}

/**
 * A WorkloadManager is responsible for assigning tasks to nodes.
 * It acts as an interface between the user and the nodes.
 * @param {NS} ns The NetScript instance. Mandatory.
 * @param {Node[]} nodes A list of nodes to assign tasks to.
 */
export class WorkloadManager
{
    constructor(ns, nodes = [])
    {
        this.ns = ns;
        this.nodes = nodes;
        this.totalAvailableRam = 0;
        this.currentAvailableRam = 0;
        this.execs = 0;
        t.init(this.ns);
    }

    /**
     * Update the current available RAM and every node state. Expensive!
     */
    async update()
    {
        this.currentAvailableRam = 0;
        this.totalAvailableRam = 0;
        for (let node of this.nodes)
        {
            await t.prof(node.update, node);
            this.currentAvailableRam += node.currentAvailableRam;
            this.totalAvailableRam += node.maxRam;
        }
    }

    /**
     * Add a node to the network.
     * @param {Node} node
     */
    async add_node(node)
    {
        this.nodes.push(node);
        await this.update();
    }

    /**
     * Get a summary of the current state of the network
     * @param {number} depth If depth is 0, only a brief summary is returned. If depth is 1, all nodes are returned.
     * @returns {string} A string containing a summary of the current state of the network
     */
    async summary(depth = 0)
    {
        await this.update();
        let summary = "";
        for (let node of this.nodes)
        {
            const node_occupancy = Math.round(node.ramUsed / node.maxRam * 100);
            if (depth >= 1)
            {
                summary += `${node.name}: ${node_occupancy}% of ${node.maxRam} RAM\n`;
            }
        }
        const occupancy = 100 - Math.round(await this.get_available_ram() / await this.get_total_ram() * 100);
        summary += `TOTAL: ${this.nodes.length} nodes, ${await lib.format_ram(this.ns, await this.get_total_ram())} RAM available (${occupancy}% used)\n`;
        return summary;
    }

    /**
     * Assign a task to be executed. The manager will assign the task to multiple nodes if necessary.
     * @param {Task|Batch} task The task to be executed. Can be a Batch or a Task.
     * @param {boolean} fill If true, upon assignment, the entire node RAM will be used to execute the task. This is useful for some misc scripts but it is not recommended for most workloads. (currently not tested)
     * @returns {number} The amount of power that was used to run the task. If this is less than the powerNeeded of the task, the task was not finished. This can also be superior to the powerNeeded of the task if the task was picked up by a node that has more cores than what the task would require.
     * @note This function will timeout after about 2 seconds.
     */
    async assign(task, fill = false) //TODO: refactor this to be more readable
    {
        this.execs++;
        let assign_time_threshold = Date.now() + 2000; // timeout is very likely caused by a bug in the workload manager, need to investigate
        let totalPowerAllocated = 0;
        if (task.tasks) // Batch; assign each task individually
        {
            for (let t of task.tasks)
            {
                totalPowerAllocated += await this.assign(t, fill);
            }
            return totalPowerAllocated;
        }
        while (task.powerNeeded > 0)
        {
            if (Date.now() > assign_time_threshold)
            {
                return totalPowerAllocated;
            }
            let allocated_power = 0;
            let node = null;
            for (let n of this.nodes)
            {
                await t.prof(n.update, n);
                if (n.currentAvailableRam >= task.cost && n.matchesPolicy(task.policy))
                {
                    node = n;
                    break;
                }
            }
            if (node === null) // No node available, too bad
            {
                return totalPowerAllocated;
            }
            node.executions = this.execs; // This is used as a unique identifier for the task, so that multiple tasks with the same arguments can be executed on the same node
            if (fill)
            {
                allocated_power += await node.fill(task) * node.cpuCores;
            }
            else
            {
                let threads = await t.prof(node.satisfaction, node, task);
                await t.prof(node.run, node, task, threads);
                allocated_power += threads;
            }
            await t.prof(node.update, node);
            this.currentAvailableRam -= task.cost; // save some time by not updating the network state; maybe risky?
            task.powerNeeded -= allocated_power;
            totalPowerAllocated += allocated_power;
        }
        return totalPowerAllocated;
    }

    /**
     * Assign a task to ALL nodes in the network.
     * @param {Task} task
     * @returns {Promise<number>} The total combined amount of power that was used to run the task.
     */
    async map(task)
    {
        let totalPowerAllocated = 0;
        for (let node of this.nodes)
        {
            if (node.matchesPolicy(task.policy))
                totalPowerAllocated += await node.run(task);
        }
        await this.update();
        return totalPowerAllocated;
    }

    /**
     * @summary Assign a task as many times as possible
     * @param {!Task} task
     * @param {boolean} fill
     * @desc I do not know if this works properly. Consider it unimplemented.
     */
    async fill(task, fill = false)
    {
        let totalPowerAllocated = 0;
        while (this.currentAvailableRam > task.cost)
        {
            try
            {
                totalPowerAllocated += await this.assign(task, fill);
            }
            catch (e)
            {
                break;
            }
        }
        return totalPowerAllocated;
    }

    /**
     * @returns {Promise<number>} The amount of currently available RAM in the network.
     */
    async get_available_ram()
    {
        await this.update();
        return this.currentAvailableRam;
    }

    /**
     * @returns {Promise<number>} The total amount of RAM available in the network.
     */
    async get_total_ram()
    {
        await this.update();
        return this.totalAvailableRam;
    }

    /**
     * Regenerate the list of nodes by scanning the network.
     * @note This can be a bit expensive and WILL OVERWRITE the existing list of nodes.
     */
    async update_network()
    {
        this.nodes = [];
        let hosts = [];
        await lib.recurse_scan(this.ns, "home", hosts, [lib.try_nuke]);
        // check if there are any new nodes
        for (let host of hosts)
        {
            let found = false;
            for (let node of this.nodes)
            {
                if (node.name == host.name)
                {
                    found = true;
                    break;
                }
            }
            if (!found)
            {
                let new_node = await createNode(this.ns, host.hostname);
                new_node = Object.assign(new_node, host); // weird but I do not really understand how constructors work in JS
                await new_node.update();
                this.nodes.push(new_node);
            }
        }
        this.nodes = this.nodes.filter(function (host) { return host.hasAdminRights; });
        this.nodes = this.nodes.filter(function (host) { return host.maxRam > 0; });
        this.totalAvailableRam = 0;
        for (let node of this.nodes)
        {
            await t.prof(node.update, node);
            this.totalAvailableRam += node.maxRam;
        }
        await this.update();
    }

    printReport()
    {
        t.printReport(this.ns);
    }
}

/**
 * The intended way to create a new network manager.
 * @param {NS} ns The NetScript object.
 * @returns {Promise<WorkloadManager>} The new WorkloadManager object.
 */
export async function createWorkloadManager(ns)
{
    let wm = new WorkloadManager(ns);
    await wm.update();
    return wm;
}