export async function main(ns)
{
    // await ns.tprint(`hack: sleeping for ${ns.args[1]}ms`);
    // await ns.print(`At start of main(): currentMoney = ${await ns.getServerMoneyAvailable(ns.args[0])}, currentSec = ${await ns.getServerSecurityLevel(ns.args[0])}`);
    await ns.sleep(ns.args[1]);
    try
    {
        let hack = await ns.hack(ns.args[0]);
        ns.tprint(`Hacked ${hack} from ${ns.args[0]}`);
    }
    catch (e)
    {
        await ns.tprint(`Error: ${e.message}`);
    }
    // ns.tprint("HACK");
    // await ns.print(`At end of main(): currentMoney = ${await ns.getServerMoneyAvailable(ns.args[0])}, currentSec = ${await ns.getServerSecurityLevel(ns.args[0])}`);
}