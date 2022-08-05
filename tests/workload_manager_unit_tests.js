import * as lib from "/lib/lib.js";
import * as wm from "/lib/workload_manager.js";
import * as t from "/lib/testing";

let _ns = null;

export async function main(ns)
{
    _ns = ns;
    lib.init(ns);
    t.init(ns);
    let manager = new wm.WorkloadManager(ns);
    t.expect_eq(manager.nodes.length, 0);
    t.expect_eq(await manager.get_available_ram(), 0);
    t.expect_eq(await manager.get_total_ram(), 0);
    let noodles = new wm.Node(ns, "n00dles");
    let foodnstuff = new wm.Node(ns, "foodnstuff");
    await manager.add_node(noodles);
    t.expect_eq(manager.nodes.length, 1);
    t.expect_eq(await manager.get_available_ram(), noodles.currentAvailableRam);
    t.expect_eq(await manager.get_total_ram(), noodles.maxRam);

    await manager.add_node(foodnstuff);
    t.expect_eq(manager.nodes.length, 2);
    t.expect_eq(await manager.get_available_ram(), noodles.currentAvailableRam + foodnstuff.currentAvailableRam);
    t.expect_eq(await manager.get_total_ram(), noodles.maxRam + foodnstuff.maxRam);

    let task = new wm.Task(ns, "wait.js", false, 100000, 0);
    let expectedPowerAllocation = noodles.satisfaction(task) + foodnstuff.satisfaction(task);
    let actualPowerAllocation = await manager.assign(task);
    t.expect_eq(actualPowerAllocation, expectedPowerAllocation);

    await ns.sleep(30);
    task = new wm.Task(ns, "wait.js", false, 1, 0);
    expectedPowerAllocation = 1;
    actualPowerAllocation = await manager.assign(task);
    t.expect_eq(actualPowerAllocation, expectedPowerAllocation);
    t.printReport();
}
