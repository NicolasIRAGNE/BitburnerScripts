import * as lib from "./lib.js";

export class Task
{
    /**
     * @param {*} ns 
     * @param {*} script The script to run
     * @param {*} canRunOnHome Whether the script can run on the home server. This is mostly used to filter out scripts that do not benefit from multiple cores.
     * @param {*} powerNeeded The amount of power with which to run the script. This is equivalent to threads * cores
     * @param  {...any} args The arguments to pass to the script
     */
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

export class Batch extends Task
{
    constructor(ns, tasks)
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
        this.cost += task.cost;
    }
}


export class WorkloadManager
{
    /**
     * @param {*} ns
     * @param {Host} nodes
     */
    constructor(ns, nodes = [])
    {
        this.ns = ns;
        this.nodes = nodes;
        this.tasks = [];
        this.scripts = [];
        this.totalAvailableRam = 0;
        this.currentAvailableRam = 0;
        this.execs = 0;
        for (let node of this.nodes)
        {
            this.totalAvailableRam += node.maxRam;
            this.currentAvailableRam += node.currentAvailableRam;
        }
    }

    /**
     * Update the current available RAM and every node state
     */
    async update()
    {
        this.currentAvailableRam = 0;
        for (let node of this.nodes)
        {
            node.update();
            this.currentAvailableRam += node.currentAvailableRam;
        }
    }

    /**
     * Get a summary of the current state of the network
     * @param {*} depth If depth is 0, only a brief summary is returned. If depth is 1, all nodes are returned.
     * @returns A string containing a summary of the current state of the network
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
     * @param {*} task The task to be executed. Can be a Batch or a Task.
     * @param {*} fill If true, upon assignment, the entire node RAM will be used to execute the task. This is useful for some misc scripts but it is not recommended for most workloads.
     * @returns The amount of satisfaction that the task has been assigned. This is the amount of power that has been allocated to the task.
     */
    async assign(task, fill = false)
    {
        this.execs++;
        let assign_time_threshold = Date.now() + 2000;
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
                if (n.currentAvailableRam >= task.cost && (task.canRunOnHome || n.name != "home"))
                {
                    node = n;
                    break;
                }
            }
            if (node === null) // No node available, too bad
            {
                return allocated_power;
            }
            node.executions = this.execs; // This is used as a unique identifier for the task, so that multiple tasks with the same arguments can be executed on the same node
            if (fill)
            {
                allocated_power += await node.fill(task) * node.cores;
            }
            else
            {
                // let t be the number of power a node can allocate to the task
                let t = node.satisfaction(task);
                let threads = Math.min(task.powerNeeded, t);
                threads = Math.ceil(threads);
                if (threads < 1)
                    threads = 1;
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
     * Apply a task to ALL nodes in the network.
     * @param {*} task 
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
     * @param {*} task 
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

