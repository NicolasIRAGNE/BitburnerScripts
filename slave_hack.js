export async function main(ns)
{
    await ns.print(`At start of main(): currentMoney = ${await ns.getServerMoneyAvailable(ns.args[0])}, currentSec = ${await ns.getServerSecurityLevel(ns.args[0])}`);
    await ns.sleep(ns.args[1]);
    let hack = await ns.hack(ns.args[0]);
    await ns.print(`Hacked ${hack} from ${ns.args[0]}`);
    await ns.print(`At end of main(): currentMoney = ${await ns.getServerMoneyAvailable(ns.args[0])}, currentSec = ${await ns.getServerSecurityLevel(ns.args[0])}`);
}