export async function main(ns)
{
    let files = await ns.ls("home").filter(f => f.endsWith(".js"));
    files.sort((a, b) => ns.getScriptRam(a) - ns.getScriptRam(b));
    for (const file of files)
    {
        ns.tprint(`${file}: ${await ns.getScriptRam(file)}`);
    }
}