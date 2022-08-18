import * as lib from "./lib/lib.js";
import * as wm from "./workload_manager.js";

let _ns = null;
let _passed = 0;
let _failed = 0;

function expect(a, b)
{
    if (a != b)
    {
        let executionContext = new Error().stack.split("\n")[2];
        _ns.tprint(`\n\t${executionContext}:\n\t\tExpected:\n\t\t\t${a}\n\t\tBut got:\n\t\t\t${b}`);
        _failed++;
    }
    else
    {
        _passed++;
    }
}

export async function main(ns)
{
    _ns = ns;
    _passed = 0;
    _failed = 0;
    lib.init(ns);
    let manager = new wm.WorkloadManager(ns);
    expect(manager.nodes.length, 0);
    expect(await manager.get_available_ram(), 0);
    expect(await manager.get_total_ram(), 0);
    let noodles = new wm.Node(ns, "n00dles");
    let foodnstuff = new wm.Node(ns, "foodnstuff");
    await manager.add_node(noodles);
    expect(manager.nodes.length, 1);
    expect(await manager.get_available_ram(), noodles.currentAvailableRam);
    expect(await manager.get_total_ram(), noodles.maxRam);

    await manager.add_node(foodnstuff);
    expect(manager.nodes.length, 2);
    expect(await manager.get_available_ram(), noodles.currentAvailableRam + foodnstuff.currentAvailableRam);
    expect(await manager.get_total_ram(), noodles.maxRam + foodnstuff.maxRam);

    let task = new wm.Task(ns, "wait.js", false, 100000, 0);
    let expectedPowerAllocation = noodles.satisfaction(task) + foodnstuff.satisfaction(task);
    let actualPowerAllocation = await manager.assign(task);
    expect(actualPowerAllocation, expectedPowerAllocation);

    task = new wm.Task(ns, "wait.js", false, 1, 0);
    expectedPowerAllocation = 1;
    actualPowerAllocation = await manager.assign(task);
    expect(actualPowerAllocation, expectedPowerAllocation);

    ns.tprint(`\n\t${_passed} tests passed, ${_failed} failed.`);
}