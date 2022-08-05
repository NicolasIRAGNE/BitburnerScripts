import * as lib from "/lib/lib.js";

/**
 * Allows specifying additional constraints on the execution of a task.
 */
export class ExecutionPolicy
{
    constructor()
    {
        this.allowed_types = ~0;
        this.strict_power_allocation = false;
    }
}

/**
 * A Task represents an operation that can be assigned to a @see Node.
 * @param {NS} ns
 * @param {string} script The script to run
 * @param {bool} canRunOnHome Whether the script can run on the home server. This is mostly used to filter out scripts that do not benefit from multiple cores.
 * @param {int} powerNeeded The amount of power with which to run the script. This is equivalent to threads * cores
 * @param  {...any} args The arguments to pass to the script
 */
export class Task
{
    constructor(ns, script, canRunOnHome, powerNeeded, ...args)
    {
        this.ns = ns;
        this.script = script;
        this.powerNeeded = powerNeeded;
        this.args = args;
        this.canRunOnHome = canRunOnHome;
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
 * A Batch is simply a collection of Tasks that can be assigned at the same time.
 * This is mostly for convenience and adding a layer of abstraction in cases where we have a lot of tasks to assign.
 * @note A Batch is also a Task, so it is possible to make Batches of Batches. Matryoshka?
 * @warn Batching tasks does NOT mean that the tasks will be executed on the same node, nor that the tasks will be executed sequentially.
 */
export class Batch extends Task
{
    constructor(ns, tasks = [])
    {
        super(ns);
        this.tasks = tasks;
        this.cost = 0; // weird, should probably use powerNeeded instead
        for (let task of tasks)
        {
            this.cost += task.cost * task.powerNeeded;
        }
    }

    add(task)
    {
        this.tasks.push(task);
        this.cost += task.cost * task.powerNeeded;
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
        if (factor < 1)
        {
            return;
        }
        if (task.tasks != null) // batch
        {
            for (let t of task.tasks)
            {
                await this.run(t, factor);
            }
        }
        else
        {
            await this.exec(task.script, factor, task.args);
        }
        return factor * this.cores;
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
        return concurrent * this.cores;
    }

    /**
     * @param {Task} task
     * @returns The amount of power the node can potentially run the task with
     */
    satisfaction(task)
    {
        let concurrent = this.currentAvailableRam / task.cost;
        concurrent = Math.floor(concurrent) * this.cores;
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
        return (policy.allowed_types & this.type) != 0;
    }
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
        this.update();
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
            node.update();
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
    summary(depth = 0)
    {
        this.update();
        let summary = "";
        for (let node of this.nodes)
        {
            const node_occupancy = Math.round(node.usedRam / node.maxRam * 100);
            if (depth >= 1)
            {
                summary += `${node.name}: ${node_occupancy}% of ${node.maxRam} RAM\n`;
            }
        }
        const occupancy = 100 - Math.round(this.currentAvailableRam / this.totalAvailableRam * 100);
        summary += `TOTAL: ${this.nodes.length} nodes, ${lib.format_ram(this.ns, this.totalAvailableRam)} RAM available (${occupancy}% used)\n`;
        return summary;
    }

    /**
     * Assign a task to be executed. The manager will assign the task to multiple nodes if necessary.
     * @param {Task|Batch} task The task to be executed. Can be a Batch or a Task.
     * @param {boolean} fill If true, upon assignment, the entire node RAM will be used to execute the task. This is useful for some misc scripts but it is not recommended for most workloads.
     * @returns {number} The amount of power that was used to run the task. If this is less than the powerNeeded of the task, the task was not finished. This can also be superior to the powerNeeded of the task if the task does not have the strict_power_allocation flag set.
     * @note This function will timeout after 2 seconds.
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
                this.ns.tprint(`Assign timed out after ${assign_time_threshold - Date.now()}ms`);
                return totalPowerAllocated;
            }
            let allocated_power = 0;
            let node = null;
            for (let n of this.nodes)
            {
                n.update();
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
                allocated_power += await node.fill(task) * node.cores;
            }
            else
            {
                // let t be the number of power a node can allocate to the task
                let threads = node.satisfaction(task)
                await node.run(task, threads);
                allocated_power += threads;
            }
            node.update();
            this.currentAvailableRam -= task.cost; // save some time by not updating the network state; maybe risky?
            task.powerNeeded -= allocated_power;
            totalPowerAllocated += allocated_power;
        }
        return totalPowerAllocated;
    }

    /**
     * Assign a task to ALL nodes in the network.
     * @param {Task} task
     */
    async map(task)
    {
        for (let node of this.nodes)
        {
            await node.run(task);
        }
        this.update();
    }

    /**
     * Assign a task as many times as possible
     * @param {!Task} task
     * @param {boolean} fill
     */
    async fill(task, fill = false)
    {
        while (this.currentAvailableRam > task.cost)
        {
            try
            {
                await this.assign(task, fill);
            }
            catch (e)
            {
                break;
            }
        }
    }

    async get_available_ram()
    {
        await this.update();
        return this.currentAvailableRam;
    }

    async get_total_ram()
    {
        await this.update();
        return this.totalAvailableRam;
    }

    /**
     * Regenerate the list of nodes by scanning the network. Should not really use this because it is slow and will overwrite any specific node configuration.
     */
    async update_network()
    {
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
                this.nodes.push(host);
            }
        }
        this.nodes = this.nodes.filter(function (host) { return host.hasRootAccess; });
        this.nodes = this.nodes.filter(function (host) { return host.maxRam > 0; });
        this.totalAvailableRam = 0;
        for (let node of this.nodes)
        {
            await node.update();
            this.totalAvailableRam += node.maxRam;
        }
        await this.update();
    }
}

