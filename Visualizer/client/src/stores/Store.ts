import { TimeManager } from '@story/shared';
import { TChapterId } from '@story/types';
import { action, makeObservable, observable } from 'mobx';
import { Agent } from './Agent';
import { ReactNode } from 'react';

/**
 * The Visualizer's root store.
 *
 * Two members went in VISUALIZER_PLAN Phase 8 with the engine they served: `chapterStore`, which
 * owned the old timeline's canvases, and `canvasHandler`, which sized every legacy canvas from a
 * single `ResizeObserver` on `document.body`. Each view now owns its own `Scene`, and a `Scene`
 * observes its own container — so there is nothing global left to co-ordinate.
 */
export class Store {
    agent: Agent;

    constructor(public timeManager: TimeManager) {
        // Same-origin (VISUALIZER_PLAN §5.4): requests go to `/api/…` and Vite's dev proxy
        // forwards them to the server on :8123. The hard-coded `http://localhost:3123` this
        // replaces named a port no config in the repo has ever mentioned, for a server that did
        // not exist — every call failed and toasted.
        this.agent = new Agent();
        makeObservable(this, {
            activeTab: observable,
            modalContent: observable.ref,
            setActiveTab: action,
            setModalContent: action,
        });
    }

    activeTab: TActiveTab = null;
    setActiveTab = (tab: TActiveTab | null) => {
        this.activeTab = tab;
        this.modalContent = null;
    };

    modalContent: ReactNode | null = null;
    setModalContent = (content: ReactNode | null) => {
        this.modalContent = content;
    };

    destroy = () => {
        /* Each view tears its own scene down through `CanvasHost`; nothing is owned here. */
    };
}

type TActiveTab =
    | null
    | {
          tab: 'chapters';
      }
    | {
          tab: 'chapter';
          chapterId: TChapterId;
      }
    | {
          tab: 'map';
          mapId: string;
      }
    /* Opened by double-clicking a location on the map (README § Visualizer; §6's table). */
    | {
          tab: 'location';
          locationId: string;
      }
    /* The structure tab: the author's type aliases (README; §6's table). */
    | {
          tab: 'structure';
      }
    /* The entities tab: every kind of thing in the story (README; §6's table). */
    | {
          tab: 'entities';
      }
    /* Opened by double-clicking a time trigger on the timeline (README; §6's table). */
    | {
          tab: 'trigger';
          chapterId: string;
          triggerId: string;
      };
