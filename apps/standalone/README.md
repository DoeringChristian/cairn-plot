# Standalone app

The existing `ui/src/plot-*` entries are being migrated here. During the
compatibility phase this app owns the legacy-descriptor-to-`PlotSpec` adapter;
the headless runtime never imports the old descriptor or React renderer tree.
