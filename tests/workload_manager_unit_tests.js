import * as lib from "/lib/lib.js";
import * as wm from "/lib/workload_manager.js";
import * as t from "/lib/testing";

let _ns = null;

async function tests_initialization(manager)
{
    t.expect_eq(manager.nodes.length, 0);
    t.expect_eq(await manager.get_available_ram(), 0);
    t.expect_eq(await manager.get_total_ram(), 0);
    let noodles = await wm.createNode(_ns, "n00dles");
    await manager.add_node(noodles);
    t.expect_eq(manager.nodes.length, 1);
    t.expect_eq(await manager.get_available_ram(), noodles.currentAvailableRam);
    t.expect_eq(await manager.get_total_ram(), noodles.maxRam);

    let foodnstuff = await wm.createNode(_ns, "foodnstuff");
    await manager.add_node(foodnstuff);
    t.expect_eq(manager.nodes.length, 2);
    t.expect_eq(await manager.get_available_ram(), noodles.currentAvailableRam + foodnstuff.currentAvailableRam);
    t.expect_eq(await manager.get_total_ram(), noodles.maxRam + foodnstuff.maxRam);
}

async function tests_assignment(manager)
{
    let noodles = await wm.createNode(_ns, "n00dles");
    let foodnstuff = await wm.createNode(_ns, "foodnstuff");
    _ns.tprint(`Noodles cores : ${noodles.cpuCores}`);
    let task = new wm.Task(_ns, "wait.js", 50000, 0);
    let expectedPowerAllocation = noodles.satisfaction(task) + foodnstuff.satisfaction(task);
    let actualPowerAllocation = await manager.assign(task);
    t.expect_eq(actualPowerAllocation, expectedPowerAllocation);
    await _ns.sleep(300);
    task = new wm.Task(_ns, "wait.js", 1, 0);
    expectedPowerAllocation = 1;
    actualPowerAllocation = await manager.assign(task);
    t.expect_eq(actualPowerAllocation, expectedPowerAllocation);
    await _ns.sleep(300);
}

/**
 * 
 * @param {wm.WorkloadManager} manager 
 */
async function tests_load(manager)
{
    const cost = 10000000;
    let task = new wm.Task(_ns, "wait.js", cost, 1000);
    _ns.tprint("Updating network...");
    await t.prof(manager.update_network, manager);
    _ns.tprint(`Total nodes: ${manager.nodes.length}`);
    _ns.tprint(`${await manager.summary(0)}`);
    let p = await t.prof(manager.assign, manager, task);
    _ns.tprint(`${await manager.summary(0)}`);
    _ns.tprint(`Allocated ${p} power`);
    await _ns.sleep(1100);
    _ns.tprint(`${await manager.summary(0)}`);
    t.expect_eq(task.powerNeeded, cost - p);

    const cost2 = await manager.get_total_ram() * 2 * task.cost;
    let big_task = new wm.Task(_ns, "wait.js", cost2, 1000);
    while (big_task.powerNeeded > 0)
    {
        let pow = await t.prof(manager.assign, manager, big_task);
        _ns.tprint(`allocated ${pow}, remaining ${big_task.powerNeeded}, ${await manager.summary(0)}`);
        await _ns.sleep(1);
    }
}

export async function run_tests(ns)
{
    _ns = ns;
    await lib.init(ns);
    t.init(ns);
    let manager = await wm.createWorkloadManager(ns);
    await tests_initialization(manager);
    await tests_assignment(manager);
    await tests_load(manager);
    manager.truc();
}

export async function main(ns)
{
    await run_tests(ns);
    t.printReport(ns);
}
