export async function main(ns)
{
    const hostname = ns.args[0];
    const hackThreshold = 0.8;
    const maxMoney = await ns.getServerMaxMoney(hostname);
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
        let moneyAvailable = await ns.getServerMoneyAvailable(hostname);
        if (moneyAvailable < maxMoney * hackThreshold)
        {
            ns.print(`Not enough money, growing...`);
            await ns.grow(hostname);
            continue;
        }
        else
        {
            ns.print(`Enough money, hacking...`);
            let money = await ns.hack(hostname);
            if (money > 0)
            {
                ns.print(`Hacked ${money} from ${hostname}`);
            }
        }
    }
}