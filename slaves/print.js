export async function main(ns)
{
    ns.tprint(`${ns.getHostname()}: ${ns.args[0]}`);
    await ns.sleep(200);
}