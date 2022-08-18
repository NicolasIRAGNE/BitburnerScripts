import * as ports from "/lib/ports.js";

export async function main(ns)
{
    let port = ns.getPortHandle(ports.share);
    await port.tryWrite(1);
    ns.atExit(() => port.clear());
    while (true)
    {
        await ns.share();
    }
}