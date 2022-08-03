/**
 * The overseer program manages an entire network and dictates the actions of all the other programs.
 * For each host in the network, the overseer will install and run appropriate programs to target a list of targets.
 */

import * as lib from "./lib.js";

class Task
{
    constructor(ns, script, canRunOnHome, threads, ...args)
    {
        this.ns = ns;
        this.script = script;
        this.threads = threads;
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
        return `${this.script} ${this.threads} ${this.args} (${this.cost}MB)`;
    }
}

class Batch extends Task
{
    constructor(ns, tasks)
    {
        super(ns);
        this.tasks = tasks;
        this.cost = 0;
        for (let task of tasks)
        {
            this.cost += task.cost;
        }
    }

    add(task)
    {
        this.tasks.push(task);
        this.cost += task.cost;
    }
}


class WorkloadManager
{
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

    update()
    {
        this.currentAvailableRam = 0;
        for (let node of this.nodes)
        {
            node.update();
            this.currentAvailableRam += node.currentAvailableRam;
        }
    }

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
     * Assign a task to be executed
     * @param {*} task 
     */
    async assign(task, fill = false)
    {
        this.execs++;
        let totalPowerAllocated = 0;
        if (task.tasks)
        {
            for (let t of task.tasks)
            {
                totalPowerAllocated += await this.assign(t, fill);
            }
            return;
        }
        while (task.threads > 0)
        {
            // await this.ns.tprint(`Remaining threads: ${task.threads}, cost: ${task.cost}`);
            let allocated_power = 0;
            // Find a node with enough RAM to run the task
            let node = null;
            for (let n of this.nodes)
            {
                if (n.currentAvailableRam >= task.cost && (task.canRunOnHome || n.name != "home"))
                {
                    node = n;
                    break;
                }
            }
            if (node === null)
            {
                // throw new Error("No node found with enough RAM to run the task");
                return allocated_power;
            }
            node.executions = this.execs;
            // await this.ns.tprint(`Found node ${node.name} with ${node.currentAvailableRam}MB RAM`);
            // Assign the task to the node
            // await this.ns.tprint(`Assigning task to ${node.name}`);
            if (fill)
            {
                allocated_power += await node.fill(task) * node.cores;
            }
            else
            {
                // let t be the number of power a node can allocate to the task
                let t = await node.satisfaction(task);
                // let p be the number of cores the node has
                let p = node.cores;
                let threads = Math.min(task.threads, t);
                threads = threads / p;
                threads = Math.floor(threads);
                if (threads < 1)
                {
                    threads = 1;
                }
                // await this.ns.tprint(`Satisfaction: ${t}, threads: ${threads}, cores: ${p}`);
                await node.run(task, threads);
                allocated_power += threads * node.cores;
            }
            this.update();
            task.threads -= allocated_power;
            totalPowerAllocated += allocated_power;
        }
        return totalPowerAllocated;
    }

    async try_assign(task, fill = false)
    {
        let totalPowerRequired = task.cost;
        let totalPowerAllocated = 0;
        while (totalPowerAllocated < totalPowerRequired)
        {
            let allocatedPower = await this.assign(task, fill);
            if (allocatedPower === 0)
            {
                break;
            }
            totalPowerAllocated += allocatedPower;
        }
        return totalPowerAllocated;
    }

    /**
     * Apply a batch to ALL nodes in the network.
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

    get_available_ram()
    {
        this.update();
        return this.currentAvailableRam;
    }

    async update_network()
    {
        let hosts = [];
        await lib.recurse_scan(this.ns, "home", hosts, [lib.try_nuke]);
        this.nodes = hosts.filter(function (host) { return host.hasRootAccess; });
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


/**
 * Generate a batch that will steal 10% of a target's money then grow it back to its original money and security
 * This function assumes that the target current security is at its minimum and current money is at its maximum
 * @param {*} ns 
 * @param {*} host 
 */
async function generate_batch(ns, host, prep = false)
{
    // First, compute the power needed to steal 10% of the target's money
    // In some cases, even with a power of 1, we will steal more than 10%. In that case, we adjust the rest of the process to restore the actual amount of money we stole.
    let hackableMoney = host.maxMoney * 0.1;
    // Money stolen by 1 thread (unaffected by cores)
    let hackPercent = await ns.formulas.hacking.hackPercent(ns.getServer(host.name), ns.getPlayer());
    let hackPowerNeeded = 0;
    if (hackPercent === 0)
    {
        hackPercent = 0.001;
    }
    if (hackPercent > 0.1)
    {
        hackPowerNeeded = 1;
    }
    else
    {
        hackPowerNeeded = (0.1) / hackPercent;
    }
    hackPowerNeeded = Math.ceil(hackPowerNeeded);
    // await ns.tprint(`Hack power needed: ${hackPowerNeeded}, hack percent: ${hackPercent}`);
    let moneyStolen = hackPowerNeeded * hackPercent;
    let currentMoneyRatio = await ns.getServerMoneyAvailable(host.name) / host.maxMoney;
    moneyStolen = (1 - currentMoneyRatio);
    if (moneyStolen < 0.1)
    {
        moneyStolen = 0.1;
    }
    // await ns.tprint(`Money stolen: ${moneyStolen}`);
    // Now, compute the power needed to restore the target's money
    let moneyStolenRatio = moneyStolen / host.maxMoney;
    let growPowerNeeded = 0;
    let targetGrowth = 1 / (1 - moneyStolen);
    let currentGrowth = 0;
    while (currentGrowth < targetGrowth)
    {
        currentGrowth = await ns.formulas.hacking.growPercent(ns.getServer(host.name), growPowerNeeded, ns.getPlayer(), 1);
        growPowerNeeded += 1;
    }
    // Now, compute the amount of security these two processes will add
    const securityAddedPerGrowth = 0.004;
    const securityAddedPerHack = 0.002;
    let securityAdded = growPowerNeeded * securityAddedPerGrowth + hackPowerNeeded * securityAddedPerHack;
    const securityRemovedByWeaken = 0.05;
    let weakenPowerNeeded = (securityAdded / securityRemovedByWeaken) * 1.01;

    // Round the numbers to the nearest integer, rounding up
    growPowerNeeded = Math.ceil(growPowerNeeded);
    weakenPowerNeeded = Math.ceil(weakenPowerNeeded);

    // Debug prints
    // await ns.tprint(`Batch for ${host.name} would require ${growPowerNeeded} growth, ${weakenPowerNeeded} weaken, and ${hackPowerNeeded} hack`);

    let batch = new Batch(ns, []);
    batch.add(new Task(ns, "slave_grow.js", true, growPowerNeeded, host.name, 0));
    batch.add(new Task(ns, "slave_weaken.js", true, weakenPowerNeeded, host.name, 0));
    if (!prep)
    {
        // wait for the weaken to finish
        let weakenTime = await ns.formulas.hacking.weakenTime(ns.getServer(host.name), ns.getPlayer());
        let growTime = await ns.formulas.hacking.growTime(ns.getServer(host.name), ns.getPlayer());
        let hackTime = await ns.formulas.hacking.hackTime(ns.getServer(host.name), ns.getPlayer());
        let offset = Math.max(weakenTime, growTime) - hackTime + 100;
        batch.add(new Task(ns, "slave_hack.js", false, hackPowerNeeded, host.name, offset));
        // await ns.tprint(`Batch for ${host.name} would require ${growPowerNeeded} growth, ${weakenPowerNeeded} weaken, and ${hackPowerNeeded} hack, with an offset of ${offset}`);
        // await ns.tprint(`Weaken time: ${await ns.formulas.hacking.weakenTime(ns.getServer(host.name), ns.getPlayer())}, hack time: ${await ns.formulas.hacking.hackTime(ns.getServer(host.name), ns.getPlayer())}, grow time: ${await ns.formulas.hacking.growTime(ns.getServer(host.name), ns.getPlayer())}`);
    }
    return batch;
}

export async function main(ns)
{
    // Get the list of hosts in the network
    let all_hosts = [];
    await lib.recurse_scan(ns, "home", all_hosts, [lib.try_nuke]);

    // At this point, hosts is a list of all the hosts in the network.
    // To get our definitive host list, we need to filter out the hosts:
    //  * where we do not have root access

    // Filter out the hosts that we do not have root access to and that have no RAM available
    let hosts = all_hosts.filter(function (host) { return host.hasRootAccess; });
    hosts = hosts.filter(function (host) { return host.maxRam > 0; });

    // Now we need our target list.
    // To get our definitive target list, we need to filter out the targets:
    //  * where we do not have enough hacking level to hack
    //  * that have no money to hack
    //  * that are on the target blacklist

    // Filter out the targets that are on the target blacklist
    let targets = all_hosts.filter(function (host) { return lib.target_blacklist.indexOf(host.name) === -1; });

    // Filter out the targets that we do not have enough hacking level to hack
    targets = targets.filter(function (host) { return host.canHack });

    // Filter out the targets that have no money to hack
    targets = targets.filter(function (host) { return host.maxMoney > 0; });

    targets = targets.filter(function (host)
    {
        return host.name === "foodnstuff" ||
            host.name === "n00dles" || 
            host.name === "iron-gym" ||
            host.name === "sigma-cosmetics" ||
            host.name === "phantasy" ||
            host.name === "joesguns";// ||
            // host.name === "johnson-ortho";
    });

    // Now we have our definitive target and host list.
    await ns.tprint(`${targets.length} hackable targets found:`);
    for (let target of targets)
    {
        await ns.tprint(`  ${target.name}`);
    }

    await ns.sleep(100);
    await ns.tprint("Starting manager...");
    await ns.sleep(100);
    let manager = new WorkloadManager(ns);
    await ns.tprint("Updating network...");
    await ns.sleep(100);
    await manager.update_network();
    await ns.sleep(100);
    await ns.tprint("Updating network...done");
    if (ns.args.find(arg => arg === "--clean"))
    {
        for (let host of hosts)
        {
            await ns.killall(host.name);
        }
        return;
    }
    await ns.tprint(`Available resources:`);
    await ns.tprint(`${manager.summary()}`);
    // await manager.map(batch);
    let tick = 0;
    // let wait_task = new Task(ns, "wait.js", 100000, 10000);
    // let pwr = await manager.assign(wait_task);
    // await ns.tprint(`${pwr} cores allocated to wait task`);

    for (let target of targets)
    {
        if (target.ready === false)
        {
            let prep_batch = await generate_batch(ns, target, true);
            let totalPowerAllocated = await manager.assign(prep_batch);
            if (totalPowerAllocated < prep_batch.cost)
            {
                await ns.tprint(`No power available to hack ${target.name}`);
                let weakenTime = await ns.formulas.hacking.weakenTime(ns.getServer(target.name), ns.getPlayer());
                let growTime = await ns.formulas.hacking.growTime(ns.getServer(target.name), ns.getPlayer());
                let hackTime = await ns.formulas.hacking.hackTime(ns.getServer(target.name), ns.getPlayer());
                let offset = Math.max(weakenTime, growTime) + 13;
                target.busyUntil = Date.now() + offset * 1.1;
                continue;
            }
        }
    }

    while (true)
    {
        // let pwr = await manager.assign(new Task(ns, "wait.js", 100000, 100000));
        if (tick % 10)
        {
            await manager.assign(new Task(ns, "purchase.js", true, 1, "20", "yes"));
            await manager.update_network();
        }
        for (let target of targets)
        {
            // await ns.tprint(`Hacking ${target.name}`);
            // For each target, need to:
            //  * weaken until we are at the minimum security level
            //  * grow until we are at the maximum security level
            //  * launch a delayed hack task
            await target.update();
            if (Date.now() < target.busyUntil)
            {
                // ns.tprint(`${target.name} is busy until ${new Date(target.busyUntil).toLocaleString()}`);
                continue;
            }
            let batch = await generate_batch(ns, target);
            if (manager.get_available_ram() >= batch.cost)
            {
                let totalPowerAllocated = await manager.assign(batch);
                // await ns.tprint(`Could not assign enough power to ${target.name} (${totalPowerAllocated}/${batch.cost})`);
                let weakenTime = await ns.formulas.hacking.weakenTime(ns.getServer(target.name), ns.getPlayer());
                let growTime = await ns.formulas.hacking.growTime(ns.getServer(target.name), ns.getPlayer());
                let hackTime = await ns.formulas.hacking.hackTime(ns.getServer(target.name), ns.getPlayer());
                let offset = Math.max(weakenTime, growTime) + 13;
                target.busyUntil = Date.now() + 500;
                // return;
            }
            await ns.sleep(4);
        }

        if (tick % 10 === 0)
        {
            await ns.tprint(`${manager.summary()}`);
        }

        await ns.sleep(100);
        tick++;
    }
}
