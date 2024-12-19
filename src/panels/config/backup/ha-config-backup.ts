import type { PropertyValues } from "lit";
import { customElement, property } from "lit/decorators";
import type { CloudStatus } from "../../../data/cloud";
import type { RouterOptions } from "../../../layouts/hass-router-page";
import { HassRouterPage } from "../../../layouts/hass-router-page";
import "../../../layouts/hass-tabs-subpage-data-table";
import type { HomeAssistant } from "../../../types";
import "./ha-config-backup-overview";
import "./ha-config-backup-backups";

@customElement("ha-config-backup")
class HaConfigBackup extends HassRouterPage {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public cloudStatus!: CloudStatus;

  @property({ type: Boolean }) public narrow = false;

  protected routerOptions: RouterOptions = {
    defaultPage: "overview",
    routes: {
      overview: {
        tag: "ha-config-backup-overview",
        cache: true,
      },
      backups: {
        tag: "ha-config-backup-backups",
        cache: true,
      },
      details: {
        tag: "ha-config-backup-details",
        load: () => import("./ha-config-backup-details"),
      },
      locations: {
        tag: "ha-config-backup-locations",
        load: () => import("./ha-config-backup-locations"),
      },
      settings: {
        tag: "ha-config-backup-settings",
        load: () => import("./ha-config-backup-settings"),
      },
    },
  };

  protected updatePageEl(pageEl, changedProps: PropertyValues) {
    pageEl.hass = this.hass;
    pageEl.route = this.routeTail;
    pageEl.narrow = this.narrow;
    pageEl.cloudStatus = this.cloudStatus;

    if (
      (!changedProps || changedProps.has("route")) &&
      this._currentPage === "details"
    ) {
      pageEl.backupId = this.routeTail.path.substr(1);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-config-backup": HaConfigBackup;
  }
}
