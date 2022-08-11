const factionsWhitelist = ["CyberSec", "NiteSec", "The Black Hand", "BitRunners", "Tian Di Hui", "Netburners", "Daedalus"]

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