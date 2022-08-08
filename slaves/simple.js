export async function main(ns)
{
    const hostname = ns.args[0];
    const minSec = await ns.getServerMinSecurityLevel(hostname);
    const secThreshold = 1;
    let currentSec = await ns.getServerSecurityLevel(hostname);
    if (currentSec > minSec + secThreshold)
    {
        ns.print(`Security level is too high, weakening...`);
        await ns.weaken(hostname);
    }
    ns.print(`Growing...`);
    await ns.grow(hostname);
}