export async function main(ns)
{
    ns.tprint(`Hello from ${ns.getHostname()}`);
    await ns.sleep(200);
}