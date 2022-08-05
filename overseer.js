/**
 * The overseer program manages an entire network and dictates the actions of all the other programs.
 * For each host in the network, the overseer will install and run appropriate programs to target a list of targets.
 */

import * as lib from "./lib.js";
import * as wm from "./workload_manager.js";

/**
 * Generate a batch that will steal hackTarget of a target's money then grow it back to its original money and security
 * This function assumes that the target current security is at its minimum and current money is at its maximum
 * @param {NS} ns 
 * @param {lib.Host} host 
 */
async function generate_batch(ns, host, prep = false)
{
    const hackTarget = 0.5;
    // First, compute the power needed to steal hackTarget of the target's money
    // In some cases, even with a power of 1, we will steal more than hackTarget. In that case, we adjust the rest of the process to restore the actual amount of money we stole.
    // Money stolen by 1 thread (unaffected by cores)
    let hackPercent = await ns.formulas.hacking.hackPercent(ns.getServer(host.name), ns.getPlayer());
    let hackPowerNeeded = 0;
    if (hackPercent === 0)
    {
        hackPercent = 0.1;
    }
    if (hackPercent > hackTarget)
    {
        hackPowerNeeded = 1;
    }
    else
    {
        hackPowerNeeded = (hackTarget) / hackPercent;
    }
    hackPowerNeeded = Math.ceil(hackPowerNeeded);
    let moneyStolen = hackTarget;
    let currentMoneyRatio = await ns.getServerMoneyAvailable(host.name) / host.maxMoney;
    if (currentMoneyRatio === 0)
    {
        currentMoneyRatio = 0.001;
    }
    if (prep)
    {
        moneyStolen = (1 - currentMoneyRatio);
    }
    if (moneyStolen < hackTarget)
    {
        moneyStolen = hackTarget;
    }
    // Now, compute the power needed to restore the target's money
    let moneyStolenRatio = moneyStolen / host.maxMoney;
    let growPowerNeeded = 0;
    let targetGrowth = 1 / (1 - hackTarget);
    growPowerNeeded = ns.growthAnalyze(host.name, targetGrowth) * 1.05;
    growPowerNeeded = Math.ceil(growPowerNeeded);

    // Now, compute the amount of security these two processes will add
    const securityAddedPerGrowth = 0.004;
    const securityAddedPerHack = 0.002;
    let securityAdded = growPowerNeeded * securityAddedPerGrowth + hackPowerNeeded * securityAddedPerHack;
    const securityRemovedByWeaken = 0.04;
    let weakenPowerNeeded = (securityAdded / securityRemovedByWeaken) * 1.1;
    weakenPowerNeeded = Math.ceil(weakenPowerNeeded);

    // Debug prints
    // await ns.tprint(`Batch for ${host.name} would require ${growPowerNeeded} growth, ${weakenPowerNeeded} weaken, and ${hackPowerNeeded} hack\n`);

    let weakenTime = await ns.formulas.hacking.weakenTime(ns.getServer(host.name), ns.getPlayer());
    let growTime = await ns.formulas.hacking.growTime(ns.getServer(host.name), ns.getPlayer());
    let hackTime = await ns.formulas.hacking.hackTime(ns.getServer(host.name), ns.getPlayer());
    // Need to delay tasks so that they are not executed in this exact order: hack, grow, weaken, within 50ms of each other
    // typically, weaken is the slowest and hack is the fastest
    let batch = new wm.Batch(ns, []);
    let delay = 0;
    // launch longest task first, with no delay
    batch.add(new wm.Task(ns, "slave_weaken.js", true, weakenPowerNeeded, host.name, 0));

    // launch second longest task, with a slight delay so that it ends right before the weaken task
    let diff = (weakenTime - 50) - growTime;
    delay = diff > 0 ? diff : 0;
    // ns.tprint(`Weaken delay: ${0}`);
    batch.add(new wm.Task(ns, "slave_grow.js", true, growPowerNeeded, host.name, delay));
    hackPowerNeeded = prep ? 0 : hackPowerNeeded;
    if (!prep)
    {
        // launch third longest task, with a slight delay so that it ends right before the grow task
        diff = (growTime - 50) - hackTime;
        delay = diff > 0 ? diff : 0;
        batch.add(new wm.Task(ns, "slave_hack.js", false, hackPowerNeeded, host.name, delay));
        // ns.tprint(`Hack delay: ${delay}`);
    }
    // ns.tprint(`Batch for ${host.name} would require ${growPowerNeeded} growth, ${weakenPowerNeeded} weaken, and ${hackPowerNeeded} hack\n`);
    return batch;
}

export async function main(ns)
{
    lib.init(ns);
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
    let targets = all_hosts.filter(function (host) { return lib.own_servers.indexOf(host.name) === -1; });

    // Filter out the targets that we do not have enough hacking level to hack
    targets = targets.filter(function (host) { return host.canHack });

    // Filter out the targets that have no money to hack
    targets = targets.filter(function (host) { return host.maxMoney > 0; });

    // Now we have our definitive target and host list.
    await ns.tprint(`${targets.length} hackable targets found:\n`);
    for (let target of targets)
    {
        await ns.tprint(`  ${target.name}\n`);
    }

    await ns.sleep(100);
    await ns.tprint("Starting manager...\n");
    await ns.sleep(100);
    let manager = new wm.WorkloadManager(ns);
    await ns.tprint("Updating network...\n");
    await ns.sleep(100);
    await manager.update_network();
    await ns.sleep(100);
    await ns.tprint("Updating network...done\n");
    if (ns.args.find(arg => arg === "--clean"))
    {
        for (let host of hosts)
        {
            await ns.killall(host.name);
        }
        return;
    }
    await ns.tprint(`Available resources:\n`);
    await ns.tprint(`${manager.summary()}\n`);
    let tick = 0;

    for (let target of targets)
    {
        let prep_batch = await generate_batch(ns, target, true);
        let timer_start = Date.now();

        let totalPowerAllocated = await manager.assign(prep_batch);
        let timer_end = Date.now();
        let timer_diff = timer_end - timer_start;
        let weakenTime = await ns.formulas.hacking.weakenTime(ns.getServer(target.name), ns.getPlayer());
        let growTime = await ns.formulas.hacking.growTime(ns.getServer(target.name), ns.getPlayer());
        let hackTime = await ns.formulas.hacking.hackTime(ns.getServer(target.name), ns.getPlayer());
        let offset = Math.max(weakenTime, growTime);
        // wait until targets are full to start the batches
        target.busyUntil = Date.now() + offset + 150;
        if (totalPowerAllocated < prep_batch.cost)
        {
            await ns.tprint(`${target.name} could not be launched because it did not have enough power\n`);
        }
    }

    while (true)
    {
        let timer_start = Date.now();
        if (tick % 100)
        {
            await manager.assign(new wm.Task(ns, "purchase.js", true, 1, "20", "yes"));
            await manager.update_network();
        }
        let timer_start_target = Date.now();
        let skipped = 0;
        let batch_timer = 0;
        let assign_timer = 0;
        let loop_threshold = Date.now() + 2000;
        for (let target of targets)
        {
            if (Date.now() > loop_threshold)
            {
                await ns.tprint(`Loop threshold reached, skipping remaining targets\n`);
                break;
            }
            // For each target, need to:
            //  * weaken until we are at the minimum security level
            //  * grow until we are at the maximum security level
            //  * launch a delayed hack task
            if (Date.now() < target.busyUntil)
            {
                skipped++;
                continue;
            }
            let batch_timer_start = Date.now();
            let batch = await generate_batch(ns, target);
            let batch_timer_end = Date.now();
            batch_timer += batch_timer_end - batch_timer_start;
            if (await manager.get_available_ram() >= batch.cost)
            {
                let assign_timer_start = Date.now();
                let totalPowerAllocated = await manager.assign(batch);
                let assign_timer_end = Date.now();
                assign_timer += assign_timer_end - assign_timer_start;
                target.busyUntil = Date.now() + 33;
                // return;
            }
            else
            {
                await ns.tprint(`Could not assign enough power to ${target.name} (${await manager.get_available_ram()}/${batch.cost})\n`);
            }
            await ns.sleep(1);
        }
        let timer_end_target = Date.now();
        // await ns.tprint(`\tTargets took ${timer_end_target - timer_start_target}ms to update (batch: ${batch_timer}ms, assign: ${assign_timer}ms), skipped ${skipped}\n`);

        if (tick % 100 === 0)
        {
            await ns.tprint(`${manager.summary()}`);
        }
        await ns.sleep(1);
        tick++;
        let timer_end = Date.now();
        await ns.tprint(`Tick ${tick} in ${timer_end - timer_start}ms (${skipped} skipped)\n`);
        // return;
    }
}