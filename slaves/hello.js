export async function main(ns)
{
    ns.tprint(`Hello from ${ns.getHostname()} (running with ${ns.args[0]} threads!)`);
    await ns.sleep(200);
}