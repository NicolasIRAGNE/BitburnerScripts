
const factionsWhitelist = ["CyberSec", "NiteSec", "The Black Hand", "BitRunners", "Tian Di Hui"]
const factionsBlacklist = ["Ishima"];
const factionFavorThreshold = 150;
const augmentationRepThreshold = 120000;

const routeToCsec = ["harakiri-sushi", "CSEC"];
const routeToNiteSec = ["iron-gym", "zer0", "neo-net", "avmnite-02h"];
const routeToBlackHand = ["n00dles", "nectar-net", "silver-helix", "crush-fitness", "I.I.I.I"]

const backdoorRoutes = [routeToCsec, routeToNiteSec, routeToBlackHand];

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

function shouldWorkForFaction(ns, faction)
{
    let augmentations = ns.singularity.getAugmentationsFromFaction(faction);
    if (factionsBlacklist.includes(faction))
        return false;
    if (ns.singularity.getFactionFavor(faction) + ns.singularity.getFactionFavorGain(faction) >= factionFavorThreshold)
        return false;
    const ownedAugmentations = ns.singularity.getOwnedAugmentations();
    augmentations = augmentations.filter(a => !ownedAugmentations.includes(a)
        && ns.singularity.getAugmentationRepReq(a) > ns.singularity.getFactionRep(faction)
        && ns.singularity.getAugmentationRepReq(a) <= augmentationRepThreshold);

    return (augmentations.length !== 0);
}

/**
 * For a given faction, determine how interesting the augmentations are.
 * We want to prioritize augmentations that are hacking-related.
 * @param {*} faction 
 */
function augmentScore(faction)
{
    let ns = _ns;
    let score = 0;
    let augs = ns.singularity.getAugmentationsFromFaction(faction);
    const ownedAugmentations = ns.singularity.getOwnedAugmentations();
    augs = augs.filter(a => !ownedAugmentations.includes(a)
        && ns.singularity.getAugmentationRepReq(a) > ns.singularity.getFactionRep(faction)
        && ns.singularity.getAugmentationRepReq(a) <= augmentationRepThreshold)
    for (const aug of augs)
    {
        const stats = ns.singularity.getAugmentationStats(aug);
        score += 10 * (stats.faction_rep_mult || 0);
        score += 5 * (stats.hacking_exp_mult || 0);
        score += 5 * (stats.hacking_growth_mult || 0);
        score += 5 * (stats.hacking_mult || 0);
        score += 5 * (stats.hacking_exp_mult || 0);
        score += 5 * (stats.hacking_speed_mult || 0);
        score += 1;
    }
    return score;
}

let _ns = null;

async function handlePlayerState(ns)
{
    const player = ns.getPlayer();
    const currentWork = ns.singularity.getCurrentWork();
    const busy = ns.singularity.isBusy();
    const factions = player.factions;
    if (factions.length === 0 && currentWork === null)
    {
        ns.singularity.applyToCompany("FoodNStuff", "Employee");
        ns.toast(`Applied to foodnstuff`, "success");
        ns.singularity.workForCompany("FoodNStuff", false);
        ns.toast(`Started working for foodnstuff`, "success");
        return;
    }
    _ns = ns;
    factions.sort((a, b) => augmentScore(b) - augmentScore(a));
    for (const faction of factions)
    {
        // ns.tprint(`${faction} score: ${augmentScore(faction)}`);
        if (shouldWorkForFaction(ns, faction))
        {
            if (currentWork !== null && currentWork.type === "FACTION" && currentWork.factionName === faction)
                break;
            ns.singularity.workForFaction(faction, "hacking", false);
            ns.toast(`Started working for ${faction}`, "success");
        }
    }
}



async function handlePotentialPurchases(ns)
{
    const moneyThreshold = 0.05; // only buy if the purchase would represent less than 5% of our money
    const player = ns.getPlayer();
    const currentMoney = player.money;
    const moneyAvailable = (currentMoney * moneyThreshold) | 0;

    // tor router
    if (moneyAvailable >= 200e3)
    {
        const alreadyHasTor = player.tor;
        const res = ns.singularity.purchaseTor();
        if (res && !alreadyHasTor)
            ns.toast(`Purchased TOR router!`, "success");
    }

    const programs = ns.singularity.getDarkwebPrograms();
    for (const program of programs)
    {
        const price = ns.singularity.getDarkwebProgramCost(program);
        // ns.tprint(`${program}: ${price}, ${moneyAvailable}`);
        if (price > moneyAvailable)
            continue;
        if (ns.fileExists(program))
            continue;
        const res = ns.singularity.purchaseProgram(program);
        if (res)
            ns.toast(`Purchased ${program} from DarkWeb`, "info", 6000);
    }

}

async function handleBackdoors(ns)
{
    const player = await ns.getPlayer();
    for (const route of backdoorRoutes)
    {
        const s = await ns.getServer(route[route.length - 1]);
        const hacking = ns.getHackingLevel();
        if (hacking >= s.requiredHackingSkill && !s.backdoorInstalled)
        {
            ns.toast(`Attempting to install backdoor on ${s.hostname}`, "info", 6000);
            for (const server of route)
            {
                await ns.singularity.connect(server);
            }
            const res = await ns.singularity.installBackdoor();
            if (res)
                ns.toast(`Installed backdoor on ${s.hostname}`, "success", 6000);
            else
                ns.toast(`Failed to install backdoor on ${s.hostname}`, "error", 6000);
        }
    }
}

export async function main(ns)
{
    while (true)
    {
        await handleFactionInvites(ns);
        await handlePlayerState(ns);
        await handlePotentialPurchases(ns);
        await handleBackdoors(ns);
        await ns.sleep(1000);
    }
}