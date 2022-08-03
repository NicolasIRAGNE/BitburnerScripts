export async function main(ns)
{
    const hostname = ns.args[0];
    const minSec = await ns.getServerMinSecurityLevel(hostname);
    const secThreshold = 20;
    while (true)
    {
        let currentSec = await ns.getServerSecurityLevel(hostname);
        if (currentSec > minSec + secThreshold)
        {
            ns.print(`Security level is too high, weakening...`);
            await ns.weaken(hostname);
            continue;
        }
        ns.print(`Growing...`);
        await ns.grow(hostname);
    }
}