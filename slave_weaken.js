export async function main(ns)
{
    // await ns.tprint(`weaken: sleeping for ${ns.args[1]}ms`);
    await ns.sleep(ns.args[1]);
    await ns.weaken(ns.args[0]);
    // await ns.tprint(`WEAKEN`);
}