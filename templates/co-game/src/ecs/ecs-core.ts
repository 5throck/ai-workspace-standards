/**
 * @file ecs-core.ts
 * @description Zero-dependency Entity Component System engine core for 2D/3D TypeScript games.
 * Manages Entity lifecycle, Component storage & retrieval, System registration & execution, and multi-component queries.
 */

export type Entity = number;

export type ComponentClass<T = any> = new (...args: any[]) => T;

export interface System {
  name?: string;
  enabled?: boolean;
  init?(world: World): void;
  update?(world: World, deltaTime: number): void;
  destroy?(world: World): void;
}

export class World {
  private nextEntityId: Entity = 1;
  private entities: Set<Entity> = new Set();
  private components: Map<ComponentClass, Map<Entity, any>> = new Map();
  private systems: System[] = [];
  private pendingDestroy: Set<Entity> = new Set();

  /**
   * Creates a new Entity and registers it in the world.
   */
  public createEntity(): Entity {
    const entity = this.nextEntityId++;
    this.entities.add(entity);
    return entity;
  }

  /**
   * Checks if an Entity exists in the world and is not queued for destruction.
   */
  public hasEntity(entity: Entity): boolean {
    return this.entities.has(entity) && !this.pendingDestroy.has(entity);
  }

  /**
   * Destroys an Entity and removes all of its associated components.
   * If immediate is false, queues entity for deferred destruction during cleanup.
   */
  public destroyEntity(entity: Entity, immediate = false): void {
    if (!this.entities.has(entity)) return;
    if (immediate) {
      this.purgeEntity(entity);
    } else {
      this.pendingDestroy.add(entity);
    }
  }

  private purgeEntity(entity: Entity): void {
    this.entities.delete(entity);
    this.pendingDestroy.delete(entity);
    for (const store of this.components.values()) {
      store.delete(entity);
    }
  }

  /**
   * Flushes all entities queued for destruction.
   */
  public cleanup(): void {
    for (const entity of this.pendingDestroy) {
      this.purgeEntity(entity);
    }
  }

  /**
   * Attaches a component instance to an entity.
   */
  public addComponent<T extends object>(entity: Entity, component: T): T {
    if (!this.hasEntity(entity)) {
      throw new Error(`Cannot add component to non-existent or pending entity ${entity}`);
    }
    const cls = component.constructor as ComponentClass<T>;
    let store = this.components.get(cls);
    if (!store) {
      store = new Map<Entity, any>();
      this.components.set(cls, store);
    }
    store.set(entity, component);
    return component;
  }

  /**
   * Retrieves a component instance from an entity by ComponentClass.
   */
  public getComponent<T>(entity: Entity, ComponentClass: ComponentClass<T>): T | undefined {
    const store = this.components.get(ComponentClass);
    return store ? store.get(entity) : undefined;
  }

  /**
   * Checks if an entity has a specific component.
   */
  public hasComponent<T>(entity: Entity, ComponentClass: ComponentClass<T>): boolean {
    const store = this.components.get(ComponentClass);
    return store ? store.has(entity) : false;
  }

  /**
   * Removes a component from an entity.
   */
  public removeComponent<T>(entity: Entity, ComponentClass: ComponentClass<T>): boolean {
    const store = this.components.get(ComponentClass);
    if (!store) return false;
    return store.delete(entity);
  }

  /**
   * Queries entities that possess all of the specified ComponentClasses.
   */
  public query(...componentClasses: ComponentClass[]): Entity[] {
    if (componentClasses.length === 0) {
      return Array.from(this.entities).filter(e => !this.pendingDestroy.has(e));
    }

    let smallestStore: Map<Entity, any> | undefined;
    let minSize = Infinity;

    for (const cls of componentClasses) {
      const store = this.components.get(cls);
      if (!store || store.size === 0) return [];
      if (store.size < minSize) {
        minSize = store.size;
        smallestStore = store;
      }
    }

    if (!smallestStore) return [];

    const result: Entity[] = [];
    for (const entity of smallestStore.keys()) {
      if (this.pendingDestroy.has(entity)) continue;
      let matchesAll = true;
      for (const cls of componentClasses) {
        const store = this.components.get(cls);
        if (!store || !store.has(entity)) {
          matchesAll = false;
          break;
        }
      }
      if (matchesAll) {
        result.push(entity);
      }
    }
    return result;
  }

  /**
   * Registers a System with the World.
   */
  public addSystem(system: System): System {
    if (system.enabled === undefined) {
      system.enabled = true;
    }
    this.systems.push(system);
    if (system.init) {
      system.init(this);
    }
    return system;
  }

  /**
   * Removes a System from the World.
   */
  public removeSystem(system: System): boolean {
    const index = this.systems.indexOf(system);
    if (index !== -1) {
      const [removed] = this.systems.splice(index, 1);
      if (removed.destroy) {
        removed.destroy(this);
      }
      return true;
    }
    return false;
  }

  /**
   * Executes all active systems' update methods in registration order, then flushes queued entity destructions.
   */
  public update(deltaTime: number): void {
    for (const system of this.systems) {
      if (system.enabled !== false && system.update) {
        system.update(this, deltaTime);
      }
    }
    this.cleanup();
  }

  /**
   * Resets the World state, purging all entities, components, and systems.
   */
  public reset(): void {
    for (const system of this.systems) {
      if (system.destroy) {
        system.destroy(this);
      }
    }
    this.entities.clear();
    this.components.clear();
    this.systems = [];
    this.pendingDestroy.clear();
    this.nextEntityId = 1;
  }

  /**
   * Returns the count of active entities.
   */
  public get entityCount(): number {
    return this.entities.size - this.pendingDestroy.size;
  }
}
