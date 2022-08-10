const factionsBlacklist = [];
const factionFavorThreshold = 150;
const augmentationRepThreshold = 49999;
const customAugmentWeights = {
    "CashRoot Starter Kit": 100
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
    const rep = ns.singularity.getFactionRep(faction);
    augs = augs.filter(a => !ownedAugmentations.includes(a)
        && ns.singularity.getAugmentationRepReq(a) > rep
        && ns.singularity.getAugmentationRepReq(a) <= augmentationRepThreshold)
    for (const aug of augs)
    {
        const stats = ns.singularity.getAugmentationStats(aug);
        const repReq = ns.singularity.getAugmentationRepReq(aug);
        // the further rep is from repReq, the lower the score
        const dist = Math.abs(rep - repReq);
        const mult = (1 - dist / augmentationRepThreshold) * (repReq / 10000) * (rep / repReq);
        // ns.tprint(`Mult for ${faction}'s ${aug}: ${mult}`);
        // ns.tprint(`${JSON.stringify(stats)} ${repReq} ${dist} ${mult}`);
        score += 10 * ((stats.faction_rep - 1) || 0) * mult;
        score += 5 * ((stats.hacking_exp - 1) || 0) * mult;
        score += 5 * ((stats.hacking_growth - 1) || 0) * mult;
        score += 5 * ((stats.hacking - 1) || 0) * mult;
        score += 5 * ((stats.hacking_exp - 1) || 0) * mult;
        score += 10 * ((stats.hacking_speed - 1) || 0) * mult;
        score += 0.1 * mult;
        score += (customAugmentWeights[aug] || 0) * mult;
    }
    // ns.tprint(`${faction} score: ${score}`);
    return score;
}

let _ns = null;

async function handlePlayerState(ns)
{
    const player = ns.getPlayer();
    const currentWork = ns.singularity.getCurrentWork();
    const busy = ns.singularity.isBusy();
    const factions = player.factions;
    if (currentWork !== null && currentWork.type === "CREATE_PROGRAM")
        return;
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

export async function main(ns)
{
    await handlePlayerState(ns);
}