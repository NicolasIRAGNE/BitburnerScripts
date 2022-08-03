export async function main(ns)
{
    // await ns.tprint(`grow: sleeping for ${ns.args[1]}ms`);
    await ns.sleep(ns.args[1]);
    await ns.grow(ns.args[0]);
    // await ns.tprint(`GROW`);
}