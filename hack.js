export async function main(ns)
{
    const hostname = ns.args[0];
    const hackThreshold = 0.8;
    const maxMoney = await ns.getServerMaxMoney(hostname);
    while (true)
    {
        let moneyAvailable = await ns.getServerMoneyAvailable(hostname);
        if (moneyAvailable < maxMoney * hackThreshold)
        {
            ns.print(`Not enough money, waiting...`);
            // await ns.grow(hostname);
            await ns.sleep(10);
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