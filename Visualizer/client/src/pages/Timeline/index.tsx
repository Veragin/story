import { Chapters } from '../../Chapters/Chapters';

/**
 * Timeline page (`#/timeline`). For now it renders the existing chapter timeline; WP5 rebuilds
 * it (triggers, y-positions, character filter, Add modal).
 */
export default function TimelinePage() {
    return <Chapters />;
}
