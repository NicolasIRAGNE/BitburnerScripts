const factionsWhitelist =
    [
        "CyberSec",
        "NiteSec",
        "The Black Hand",
        "BitRunners",
        "Tian Di Hui",
        "Netburners",
        "Daedalus",
        "Slum Snakes",
        "Tetrads",
        "Shadows of Anarchy",
        "The Syndicate",
        "The Covenant",
        "Fulcrum Secret Technologies",
        "The Dark Army",
        "Illuminati",
        "ECorp",
        "MegaCorp",
        "KuaiGong International",
        "Four Sigma",
        "NWO",
        "Blade Industries",
        "OmniTek Incorporated",
        "Bachman & Associates",
        "Clarke Incorporated",
    ]

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

export async function main(ns)
{
    await handleFactionInvites(ns);
}