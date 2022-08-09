/**
 * @fileOverview Provides some examples on how to use the workload manager.
 * Functions to be profiled are called with the following signature:
 *      t.prof(<class>.<function>, <class_instance>, <...args>);
 * This is equivalent to calling the function directly.
 */

import * as lib from "/lib/lib.js";
import * as wm from "/lib/workload_manager.js";
import * as t from "/lib/testing";

export async function main(ns)
{
    const manager = await wm.createWorkloadManager(ns);
    ns.tprint(`Scanning network...`);
    await t.prof(manager.update_network, manager); // scan the network for potential nodes (servers with root access)
    ns.tprint(`${await manager.summary()}`);
    const helloTask = new wm.Task(ns, "/slaves/hello.js", 60); // create a task to run the hello.js slave with 60 threads
    helloTask.policy =
    {
        forbidden_types: lib.HostType.HOME, // Forbid task to run on home (useful for tasks that do not benefit from having multiple cores)
        pass_threads: true, // Number of threads used to invoke the task is passed as an argument to the underlying script
    };
    const taskCostTmp = helloTask.powerNeeded;
    ns.tprint(`Assigning a task of cost ${taskCostTmp}...`)
    let powerAllocated = await t.prof(manager.assign, manager, helloTask); // tell the manager to run the task
    ns.tprint(`Total power allocated: ${powerAllocated} / ${taskCostTmp} (${helloTask.powerNeeded} remaining)`);
    ns.tprint(`${await manager.summary()}`);
    await ns.sleep(300);
    ns.tprint(`${await manager.summary()}`);

    // you can also group tasks together in a single batch, useful for HWGW batches
    const batch = new wm.Batch(ns,
        [
            new wm.Task(ns, "/slaves/print.js", 1, "Hello?"),
            new wm.Task(ns, "/slaves/print.js", 1, "Is it me you're looking for?"),
            new wm.Task(ns, "/slaves/print.js", 1, "no sry")
        ]
    );
    const batchCostTmp = batch.powerNeeded;
    ns.tprint(`Assigning a batch of cost ${batchCostTmp}...`)
    powerAllocated = await t.prof(manager.assign, manager, batch);
    ns.tprint(`Total power allocated: ${powerAllocated} / ${batchCostTmp}`);

    ns.tprint(`Assigning a task to the whole network...`)
    await manager.map(new wm.Task(ns, "/slaves/print.js", 1, "🧍‍♂️"));
    await ns.sleep(200);
    // print profiling reports
    await manager.printReport();
    await t.printReport(ns);
}