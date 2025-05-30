/**
 * A bidirectional dependency graph. Nodes are arbitrary strings
 * (file paths, template keys, etc.). You can record "page
 * A depends on resource B" and later query "which pages are
 * affected if B changed?".
 */
export class DependencyGraph {
    // page → set of dependencies
    private dependencies: Map<string, Set<string>>;

    // resource → set of pages that depend on it
    private dependents: Map<string, Set<string>>;

    /**
     * Create a new dependency graph.
     *
     * The graph is empty at first.
     */
    constructor() {
        this.dependencies = new Map();
        this.dependents = new Map();
    }

    /**
     * Ensure that the given node exists in the graph.
     *
     * @param node  the node to ensure
     */
    private ensureNode(node: string): void {
        if (!this.dependencies.has(node))
            this.dependencies.set(node, new Set());
        if (!this.dependents.has(node)) this.dependents.set(node, new Set());
    }

    /**
     * Record that `page` (or consumer) depends on `resource`.
     *
     * @param page      the consumer node
     * @param resource  the dependency node
     */
    addDependency(page: string, resource: string): void {
        this.ensureNode(page);
        this.ensureNode(resource);
        this.dependencies.get(page)?.add(resource);
        this.dependents.get(resource)?.add(page);
    }

    /**
     * Get all nodes that are affected by a change to `changed`.
     *
     * @param changed  the node that changed
     * @returns  set of nodes that are affected by the change
     */
    getStaleNodes(changed: string): string[] {
        const affected = new Set<string>();
        const queue: string[] = [];

        // start with pages that directly depend on `changed`
        const direct = this.dependents.get(changed);
        if (direct) {
            for (const page of direct) {
                affected.add(page);
                queue.push(page);
            }
        }

        // BFS in reverse graph
        while (queue.length > 0) {
            const curr = queue.shift();
            if (!curr) continue;

            const parents = this.dependents.get(curr);
            if (!parents) continue;
            for (const pg of parents) {
                if (!affected.has(pg)) {
                    affected.add(pg);
                    queue.push(pg);
                }
            }
        }

        return Array.from(affected);
    }

    /**
     * Remove a recorded dependency.
     *
     * @param page      the consumer node
     * @param resource  the dependency node
     */
    removeDependency(page: string, resource: string): void {
        this.dependencies.get(page)?.delete(resource);
        this.dependents.get(resource)?.delete(page);
    }

    /**
     * Get dependencies of a given page.
     *
     * @param page
     * @returns  set of resources the page depends on
     */
    getDependencies(page: string): Set<string> | undefined {
        return this.dependencies.get(page);
    }

    /**
     * Get dependents of a given resource.
     *
     * @param resource
     * @returns  set of pages that depend on the resource
     */
    getDependents(resource: string): Set<string> | undefined {
        return this.dependents.get(resource);
    }

    /**
     * Get all nodes in the graph.
     */
    getAllNodes(): string[] {
        return Array.from(
            new Set([...this.dependencies.keys(), ...this.dependents.keys()]),
        );
    }
}
