/**
 * The mapper program will scan a network and output a .dot GraphViz file of the network.
 * The graph will show the connections between hosts.
 * NOTE: this doesnt fucking work and i dont feel like fixing it.
 */

import * as lib from "./lib/lib.js";

class Node
{
    constructor(name)
    {
        this.name = name;
        this.children = [];
    }
}

class Graph
{
    constructor()
    {
        this.nodes = [];
    }

    async addNode(node)
    {
        this.nodes.push(node);
    }
}

async function addNodeToGraph(ns, graph, node, father)
{
    if (!father)
    {
        await graph.addNode(node);
        return;
    }
    let fatherNode = await graph.nodes.find(n => n.name === father);
    await ns.tprint(`Adding ${node.name} to graph`);
    
    if (!fatherNode)
    {
        await ns.tprint(`${father} does not exist in the graph.`);
        fatherNode = new Node(father);
        await graph.addNode(fatherNode);
    }
    else
    {
        await ns.tprint(`${fatherNode.name} -> ${node.name}`);
        await fatherNode.children.push(node);
        await graph.addNode(node);
    }
}

async function recurse_add_node(ns, hostname, graph, father)
{
    let host = new Node(hostname);
    await addNodeToGraph(ns, graph, host, father);
    let children = await ns.scan(hostname);
    for (let child of children)
    {
        // if child name contains "rob", continue
        if (child !== father && child.indexOf("rob") === -1)
        {
            await recurse_add_node(ns, child, graph, hostname);
        }
    }
}

export async function main(ns)
{
    let hosts = [];
    await lib.recurse_scan(ns, "home", hosts);
    let graph = new Graph();
    await recurse_add_node(ns, "home", graph);
    for (let node of graph.nodes)
    {
        // if name contains "-" or ".", replace with "_"
        await ns.tprint(`${node.name}`);
        while (node.name.indexOf("-") !== -1 || node.name.indexOf(".") !== -1 || node.name.indexOf("4") !== -1)
        {
            node.name = node.name.replace("-", "_");
            node.name = node.name.replace(".", "_");
            node.name = node.name.replace("4", "FOUR");
        }
    }
    let dot = "digraph {\n";
    for (let node of graph.nodes)
    {
        dot += `${node.name} [pos="${node.x},${node.y}"];\n`;
    }
    for (let node of graph.nodes)
    {
        for (let child of node.children)
        {
            dot += `${node.name} -> ${child.name};\n`;
        }
    }
    dot += "}";
    ns.tprint(dot);
    ns.write("graph.txt", dot, "w");
}