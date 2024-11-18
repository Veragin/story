import { Graph } from '../../Graph';
import { ColorManager } from './ColorManager';
import { EdgeActualizer } from './edges/EdgeActualizer';
import { NodeActualizer } from './nodes/NodeActualizer';
import { NodeFactory } from './nodes/NodeFactory';
import { PassageLoader } from './PassageLoader';

export class GraphActualizer {
    private readonly colorManager: ColorManager = new ColorManager();
    private readonly nodeActualizer: NodeActualizer = new NodeActualizer(new NodeFactory(this.colorManager));
    private readonly edgeActualizer: EdgeActualizer = new EdgeActualizer();
    private readonly passageLoader: PassageLoader = new PassageLoader();

    async actualizeGraphData(eventId: string, graph: Graph): Promise<Graph> {
        // Load current passages
        const currentPassages = await this.passageLoader.loadPassages(eventId);
        if (!currentPassages) {
            console.error(`No passages found for event ${eventId}`);
            return graph;
        }

        // Initialize colors for new passage nodes
        this.colorManager.initializeCharacterColors(currentPassages);

        const nodeResult = await this.nodeActualizer.actualizeNodes(graph, currentPassages);

        await this.edgeActualizer.actualizeEdges(graph, currentPassages, nodeResult.existingNodes);

        return graph;
    }
}
