import * as lib from "/lib/lib.js";
import * as wm from "/lib/workload_manager.js";
import * as t from "/lib/testing";

export async function main(ns)
{
    let manager = await wm.createWorkloadManager(ns);
    await manager.update_network();
    ns.tprint(`Manager initialized:\n${await manager.summary(0)}\n`);
    let task = new wm.Task(ns, "/slaves/hello.js", 1);
    task.policy = { forbidden_types: lib.HostType.HOME }; // forbid task to run on home server
    await manager.map(task); // map task to available servers
    ns.tprint(`Task mapped to ${manager.nodes.length - 1} servers:\n${await manager.summary(0)}\n`);
    await ns.sleep(100);

    // 1000 indicates that the task should be run with a magnitude of 1000 (i.e. 1000 threads)
    // this is too big for a single server, so it should be split up into whatever nodes it can run on
    // in my case, it is even too big for the entire network, so it will not be fully ran
    task = new wm.Task(ns, "/slaves/hello.js", 1000);
    let powerAllocated = await manager.assign(task);
    ns.tprint(`${await manager.summary(0)}`);
    ns.tprint(`Allocated ${powerAllocated} power, remaining ${task.powerNeeded}`);
}