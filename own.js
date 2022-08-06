/**
 * Install and run a script on owned servers.
 */

import * as lib from "./lib/lib.js";

export async function main(ns)
{
    await lib.init(ns);
    const ramCost = await ns.getScriptRam(ns.args[0]);
    let total = 0;
    let hosts = lib.own_servers.filter(s => !(s.type & lib.HostType.HOME));
    for (let server of hosts)
    {
        let host = server.name;
        try
        {
            await ns.killall(host);
            await ns.scp(ns.args[0], host);
            const usedRam = await ns.getServerUsedRam(host);
            const maxRam = await ns.getServerMaxRam(host);
            let threads = (maxRam - usedRam) / ramCost;
            threads = Math.floor(threads);
            if (threads < 1)
            {
                throw new Error(`Not enough RAM on ${host}`);
            }
            await ns.tprint(`${ns.args[0]} installed on ${host} with ${threads} threads`);
            await ns.exec(ns.args[0], host, threads);
            total += threads;
        }
        catch (e)
        {
            await ns.tprint(`Error installing ${ns.args[0]} on ${host}: ${e}`);
        }
    }
    await ns.tprint(`${ns.args[0]} ran on ${total} threads`);
}