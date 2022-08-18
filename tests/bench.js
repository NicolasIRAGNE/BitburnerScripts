import * as lib from "/lib/lib.js";
import * as t from "/lib/testing.js";
import * as wm from "/lib/workload_manager.js";

let _ns = null;

export async function main(ns)
{
    _ns = ns;
    t.init(ns);
    ns.atExit(() => {
        t.printReport(ns);
    });
    let node = await wm.createNode(ns, "foodnstuff");
    for (let i = 0; i < 100000; i++)
    {
        await t.prof(node.update, node);
    }
}