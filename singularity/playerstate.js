const playerstatePort = 1;

function getSpendableMoney(ns)
{
    let currentIncome = ns.getTotalScriptIncome()[0];
    return currentIncome;
}

const factionsBlacklist = [
    "Shadows of Anarchy"
];
const factionFavorThreshold = 150;
const augmentationRepThreshold = 18e3;
const customAugmentWeights = {
    "CashRoot Starter Kit": 100,
    "Neuroreceptor Management Implant": 1e3,
    "ECorp HVMind Implant": 1e3,
}

const customFactionWeights = {
    // "Daedalus": 40,
}

const megacorporations =
    [
        "ECorp",
        "MegaCorp",
        "KuaiGong International",
        "Four Sigma",
        "NWO",
        "Blade Industries",
        "OmniTek Incorporated",
        "Bachman & Associates",
        "Clarke Incorporated",
        "Fulcrum Technologies"
    ];

let augmentCounts = {};

const targetCharisma = 100;
const targetStrength = 50;
const targetDefense = 50;
const targetDexterity = 50;
const targetAgility = 50;

const agility =
{
    target: targetAgility,
    course: "Agility",
    place: "Powerhouse Gym",
    name: "agility"
};

const charisma =
{
    target: targetCharisma,
    course: "Leadership",
    place: "Rothman University",
    name: "charisma"
};

const strength =
{
    target: targetStrength,
    course: "Strength",
    place: "Powerhouse Gym",
    name: "strength"
};

const dexterity =
{
    target: targetDexterity,
    course: "Dexterity",
    place: "Powerhouse Gym",
    name: "dexterity"
};

const defense =
{
    target: targetDefense,
    course: "Defense",
    place: "Powerhouse Gym",
    name: "defense"
};

const stats = [charisma, agility, strength, dexterity, defense];

const statWeights =
{
    hacking_chance: 15,
    hacking_speed: 60,
    hacking_money: 20,
    hacking_grow: 22,
    hacking: 20,
    hacking_exp: 50,
    strength: 3,
    strength_exp: 3,
    defense: 3,
    defense_exp: 3,
    dexterity: 3,
    dexterity_exp: 3,
    agility: 3,
    agility_exp: 3,
    charisma: 7,
    charisma_exp: 7,
    hacknet_node_money: 1,
    hacknet_node_purchase_cost: 1,
    hacknet_node_ram_cost: 1,
    hacknet_node_core_cost: 1,
    hacknet_node_level_cost: 1,
    company_rep: 5,
    faction_rep: 15,
    work_money: 0.1,
    crime_success: 0.2,
    crime_money: 0,
    bladeburner_max_stamina: 1,
    bladeburner_stamina_gain: 1,
    bladeburner_analysis: 1,
    bladeburner_success_chance: 1
};

let state = "none";

function shouldWorkForFaction(ns, faction)
{
    let augmentations = ns.singularity.getAugmentationsFromFaction(faction);
    if (factionsBlacklist.includes(faction))
        return false;
    // if (ns.singularity.getFactionFavor(faction) + ns.singularity.getFactionFavorGain(faction) >= factionFavorThreshold)
    //     return false;
    const ownedAugmentations = ns.singularity.getOwnedAugmentations(true);
    augmentations = augmentations.filter(a => !ownedAugmentations.includes(a)
        && ns.singularity.getAugmentationRepReq(a) > ns.singularity.getFactionRep(faction)
        && ns.singularity.getAugmentationRepReq(a) <= augmentationRepThreshold);

    return (augmentations.length !== 0 && augmentScore(faction) > 0);
}

function shouldWorkForCompany(ns, player, company)
{
    // const rep = ns.singularity.getCompanyRep(company);
    const rep = 0; // temporary
    const factions = player.factions.filter((faction) => factionsBlacklist.indexOf(faction) === -1);

    if (factions.includes(company) || rep >= 400000)
    {
        return false;
    }
    return true;
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
    const ownedAugmentations = ns.singularity.getOwnedAugmentations(true);
    const rep = ns.singularity.getFactionRep(faction);
    const favor = ns.singularity.getFactionFavor(faction);
    const potentialFavor = favor + ns.singularity.getFactionFavorGain(faction);
    augs = augs.filter(a => !ownedAugmentations.includes(a)
        && ns.singularity.getAugmentationRepReq(a) > rep
        && ns.singularity.getAugmentationRepReq(a) <= augmentationRepThreshold)
    // ns.tprint(`${faction} has ${augs.length} augmentations`);
    for (const aug of augs)
    {
        const augStats = ns.singularity.getAugmentationStats(aug);
        const repReq = ns.singularity.getAugmentationRepReq(aug);
        if (rep >= repReq)
        {
            ns.tprint(`${aug} is owned`);
            continue;
        }
        // the further rep is from repReq, the lower the score
        // ns.tprint(`Calculations details: ${aug} repReq: ${repReq} rep: ${rep} favor: ${favor} potentialFavor: ${potentialFavor} mult: ${mult}`);
        const dist = Math.abs(rep - repReq);
        let mult = (repReq / 1000) * ((rep + 1000) / repReq) * ((1 + favor / 10000) * (potentialFavor < factionFavorThreshold ? 10000 : 1));
        let distMult = 1 + Math.pow(1 - dist / repReq, 4) * 10;
        if (augmentCounts[aug] <= 1) // augmentation is available in only one faction
        {
            mult *= distMult;
        }
        else
        {
        }
        // score += mult;
        if (faction in customFactionWeights)
            mult *= customFactionWeights[faction];
        let augScore = 0;
        for (const stat in augStats)
        {
            if (stat in statWeights)
            {
                augScore += (augStats[stat] - 1) * statWeights[stat] * mult;
                // if (faction === "ECorp" || faction === "Illuminati")
                //     ns.tprint(`${aug} has stat ${stat} with value ${augStats[stat]} and weight ${statWeights[stat]} and mult ${mult}`);
            }
        }
        if (aug in customAugmentWeights)
        {
            augScore *= customAugmentWeights[aug];
        }
        // augScore += 0.00001 * mult;
        // if (faction === "Tetrads" || faction === "The Syndicate")
        // ns.tprint(`${aug} has score ${augScore}`);
        score += augScore;
    }
    return score;
}

function getAugmentCounts(ns, factions)
{
    let augmentations = [];
    augmentCounts = {};
    for (const faction of factions)
    {
        augmentations = augmentations.concat(ns.singularity.getAugmentationsFromFaction(faction));
    }
    for (const aug of augmentations)
    {
        if (aug in augmentCounts)
            augmentCounts[aug]++;
        else
            augmentCounts[aug] = 1;
    }
}

let _ns = null;

async function handleStats(ns, player)
{
    // for (const stat of stats)
    // {
    //     if (player.skills[stat.name] < stat.target)
    //     {
    //         if (state === stat.name)
    //             return true;
    //         let res = false;
    //         if (stat.place.includes("University"))
    //             res = ns.singularity.universityCourse(stat.place, stat.course, false);
    //         if (stat.place.includes("Gym"))
    //             res = ns.singularity.gymWorkout(stat.place, stat.course, false);
    //         if (res)
    //         {
    //             state = stat.name;
    //             ns.toast(`Started training ${stat.course} at ${stat.place}`);
    //             return true;
    //         }
    //         else
    //         {
    //             ns.toast(`Could not start training ${stat.course} at ${stat.place}`, "error");
    //         }
    //     }
    // }
    // return false;
}

async function handlePlayerState(ns)
{
    const player = ns.getPlayer();
    let factions = player.factions.filter((faction) => factionsBlacklist.indexOf(faction) === -1);
    const currentWork = ns.singularity.getCurrentWork();
    if (currentWork === null)
    {
        state = "none";
    }
    // const busy = ns.singularity.isBusy();
    // let s = await handleStats(ns, player);
    // if (s)
    //     return;
    // if (currentWork !== null && currentWork.type === "CREATE_PROGRAM")
    // {
    //     state = "program";
    //     return;
    // }
    getAugmentCounts(ns, factions);
    factions.sort((a, b) => augmentScore(b) - augmentScore(a));
    factions = factions.filter((faction) => shouldWorkForFaction(ns, faction));
    for (const faction of factions)
    {
        const donateMoney = getSpendableMoney(ns) * 0.3;
        let d = ns.singularity.donateToFaction(faction, donateMoney);
        if (d)
            ns.toast(`Donated ${ns.nFormat(donateMoney, "0.00a")} to ${faction}`);
        // ns.tprint(`${faction} score: ${augmentScore(faction)}`);
    }
    for (const faction of factions)
    {

        if (currentWork !== null && currentWork.type === "FACTION" && currentWork.factionName === faction)
        {
            state = "faction";
            return;
        }
        let res = ns.singularity.workForFaction(faction, "hacking", false);;
        if (!res)
            res = ns.singularity.workForFaction(faction, "security", false);
        if (!res)
            res = ns.singularity.workForFaction(faction, "field", false);

        if (res)
        {
            ns.toast(`Started working for ${faction}`, "success");
            state = "faction";
            return;
        }
    }
    // let companies = [...megacorporations];
    // companies.sort((a, b) => (ns.singularity.getCompanyFavor(b)) - (ns.singularity.getCompanyFavor(a)));
    // companies.push("FoodNStuff");
    // for (const company of companies)
    // {
    //     if (shouldWorkForCompany(ns, player, company))
    //     {
    //         let jobType = megacorporations.includes(company) ? "it" : "Employee";
    //         let res = ns.singularity.applyToCompany(company, jobType);
    //         if (res && megacorporations.includes(company))
    //             ns.toast(`Applied to ${company}`, "success");
    //         if (currentWork !== null && currentWork.type === "COMPANY" && currentWork.companyName === company)
    //             break;
    //         res = ns.singularity.workForCompany(company, false);
    //         if (res)
    //         {
    //             ns.toast(`Started working for ${company}`, "success");
    //             state = "company";
    //             return;
    //         }
    //     }
    // }
}

export async function main(ns)
{
    _ns = ns;
    state = ns.readPort(playerstatePort);
    // ns.tprint(`current state: ${state}`);
    await handlePlayerState(ns);
    ns.writePort(playerstatePort, state);
}