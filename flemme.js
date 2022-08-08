
const factionsWhitelist = ["CyberSec", "NiteSec", "The Black Hand", "BitRunners", "Tian Di Hui"]
const factionFavorThreshold = 150;

async function handleFactionInvites(ns)
{
    let invites = ns.singularity.checkFactionInvitations(ns);
    for (const faction of invites)
    {
        if (factionsWhitelist.includes(faction))
        {
            ns.singularity.joinFaction(faction);
            ns.toast(`Joined ${faction}!`, "success");
        }
    }
}

async function handlePlayerState(ns)
{
    const busy = ns.singularity.isBusy();
    if (busy)
        return;
    const factions = ns.getPlayer().factions;
    for (const faction of factions)
    {
        if (ns.singularity.getFactionFavor(faction) + ns.singularity.getFactionFavorGain(faction) < factionFavorThreshold)
        {
            const res = ns.singularity.workForFaction(faction, "hacking", false);
            if (res)
                ns.toast(`Started working for ${faction}`, "info");
            else
                ns.toast(`Error while trying to work for ${faction}`, "error");
            return;
        }
    }
}

async function handlePotentialPurchases(ns)
{
    const moneyThreshold = 0.05; // only buy if the purchase would represent less than 5% of our money
    const currentMoney = ns.getPlayer().money;
    const moneyAvailable = (currentMoney * moneyThreshold) | 0;
    
    // tor router
    if (moneyAvailable >= 200e3)
    {
        ns.singularity.purchaseTor();
        return;
    }
    const programs = ns.singularity.getDarkwebPrograms();
    for (const program of programs)
    {
        const price = ns.singularity.getDarkwebProgramCost(program);
        if (price > moneyAvailable)
            continue;
        const res = ns.singularity.purchaseProgram(program);
        if (res)
            ns.toast(`Purchased ${program} from DarkWeb`, "info");
    }

}

export async function main(ns)
{
    var running = true;
    while (running)
    {
        await handleFactionInvites(ns);
        await handlePlayerState(ns);
        await ns.sleep(1000);
    }
}