import type { CSSResultGroup, PropertyValues, TemplateResult } from "lit";
import { LitElement, css, html, nothing } from "lit";
import { mdiPencil, mdiDownload } from "@mdi/js";
import { customElement, property, state } from "lit/decorators";
import "../../components/ha-menu-button";
import "../../components/ha-list-item";
import "../../components/ha-top-app-bar-fixed";
import type { LovelaceConfig } from "../../data/lovelace/config/types";
import { haStyle } from "../../resources/styles";
import type { HomeAssistant } from "../../types";
import "../lovelace/components/hui-energy-period-selector";
import type { Lovelace } from "../lovelace/types";
import "../lovelace/views/hui-view";
import "../lovelace/views/hui-view-container";
import { navigate } from "../../common/navigate";
import type {
  GridSourceTypeEnergyPreference,
  SolarSourceTypeEnergyPreference,
  BatterySourceTypeEnergyPreference,
  GasSourceTypeEnergyPreference,
  WaterSourceTypeEnergyPreference,
  DeviceConsumptionEnergyPreference,
} from "../../data/energy";
import {
  getEnergyDataCollection,
  getEnergyGasUnit,
  getEnergyWaterUnit,
} from "../../data/energy";
import { fileDownload } from "../../util/file_download";

const ENERGY_LOVELACE_CONFIG: LovelaceConfig = {
  views: [
    {
      strategy: {
        type: "energy",
      },
    },
  ],
};

@customElement("ha-panel-energy")
class PanelEnergy extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ type: Boolean, reflect: true }) public narrow = false;

  @state() private _viewIndex = 0;

  @state() private _lovelace?: Lovelace;

  public willUpdate(changedProps: PropertyValues) {
    if (!this.hasUpdated) {
      this.hass.loadFragmentTranslation("lovelace");
    }
    if (!changedProps.has("hass")) {
      return;
    }
    const oldHass = changedProps.get("hass") as this["hass"];
    if (oldHass?.locale !== this.hass.locale) {
      this._setLovelace();
    }
    if (oldHass && oldHass.localize !== this.hass.localize) {
      this._reloadView();
    }
  }

  protected render(): TemplateResult {
    return html`
      <div class="header">
        <div class="toolbar">
          <ha-menu-button
            slot="navigationIcon"
            .hass=${this.hass}
            .narrow=${this.narrow}
          ></ha-menu-button>
          ${!this.narrow
            ? html`<div class="main-title">
                ${this.hass.localize("panel.energy")}
              </div>`
            : nothing}

          <hui-energy-period-selector
            .hass=${this.hass}
            collection-key="energy_dashboard"
          >
            ${this.hass.user?.is_admin
              ? html` <ha-list-item
                  slot="overflow-menu"
                  graphic="icon"
                  @request-selected=${this._navigateConfig}
                >
                  <ha-svg-icon slot="graphic" .path=${mdiPencil}> </ha-svg-icon>
                  ${this.hass!.localize("ui.panel.energy.configure")}
                </ha-list-item>`
              : nothing}
            <ha-list-item
              slot="overflow-menu"
              graphic="icon"
              @request-selected=${this._dumpCSV}
            >
              <ha-svg-icon slot="graphic" .path=${mdiDownload}> </ha-svg-icon>
              ${this.hass!.localize("ui.panel.energy.download_data")}
            </ha-list-item>
          </hui-energy-period-selector>
        </div>
      </div>

      <hui-view-container
        .hass=${this.hass}
        @reload-energy-panel=${this._reloadView}
      >
        <hui-view
          .hass=${this.hass}
          .narrow=${this.narrow}
          .lovelace=${this._lovelace}
          .index=${this._viewIndex}
        ></hui-view>
      </hui-view-container>
    `;
  }

  private _setLovelace() {
    this._lovelace = {
      config: ENERGY_LOVELACE_CONFIG,
      rawConfig: ENERGY_LOVELACE_CONFIG,
      editMode: false,
      urlPath: "energy",
      mode: "generated",
      locale: this.hass.locale,
      enableFullEditMode: () => undefined,
      saveConfig: async () => undefined,
      deleteConfig: async () => undefined,
      setEditMode: () => undefined,
      showToast: () => undefined,
    };
  }

  private _navigateConfig(ev) {
    ev.stopPropagation();
    navigate("/config/energy?historyBack=1");
  }

  private async _dumpCSV(ev) {
    ev.stopPropagation();
    const energyData = getEnergyDataCollection(this.hass, {
      key: "energy_dashboard",
    });

    if (!energyData.prefs || !energyData.state.stats) {
      return;
    }

    const gasUnit =
      getEnergyGasUnit(
        this.hass,
        energyData.prefs,
        energyData.state.statsMetadata
      ) || "";
    const waterUnit = getEnergyWaterUnit(this.hass);
    const electricUnit = "kWh";

    const energy_sources = energyData.prefs.energy_sources;
    const device_consumption = energyData.prefs.device_consumption;
    const stats = energyData.state.stats;

    const timeSet = new Set<number>();
    Object.values(stats).forEach((stat) => {
      stat.forEach((datapoint) => {
        timeSet.add(datapoint.start);
      });
    });
    const times = Array.from(timeSet).sort();

    const headers =
      "entity_id,type,unit," +
      times.map((t) => new Date(t).toISOString()).join(",") +
      "\n";
    const csv: string[] = [];
    csv[0] = headers;

    const processStat = function (stat: string, type: string, unit: string) {
      let n = 0;
      const row: string[] = [];
      if (!stats[stat]) {
        return;
      }
      row.push(stat);
      row.push(type);
      row.push(unit.normalize("NFKD"));
      times.forEach((t) => {
        if (n < stats[stat].length && stats[stat][n].start === t) {
          row.push((stats[stat][n].change ?? "").toString());
          n++;
        } else {
          row.push("");
        }
      });
      csv.push(row.join(",") + "\n");
    };

    const currency = this.hass.config.currency;

    const printCategory = function (
      type: string,
      statIds: string[],
      unit: string,
      costType?: string,
      costStatIds?: string[]
    ) {
      if (statIds.length) {
        statIds.forEach((stat) => processStat(stat, type, unit));
        if (costType && costStatIds) {
          costStatIds.forEach((stat) => processStat(stat, costType, currency));
        }
      }
    };

    const grid_consumptions: string[] = [];
    const grid_productions: string[] = [];
    const grid_consumptions_cost: string[] = [];
    const grid_productions_cost: string[] = [];
    energy_sources
      .filter((s) => s.type === "grid")
      .forEach((source) => {
        source = source as GridSourceTypeEnergyPreference;
        source.flow_from.forEach((flowFrom) => {
          const statId = flowFrom.stat_energy_from;
          grid_consumptions.push(statId);
          const costId =
            flowFrom.stat_cost || energyData.state.info.cost_sensors[statId];
          if (costId) {
            grid_consumptions_cost.push(costId);
          }
        });
        source.flow_to.forEach((flowTo) => {
          const statId = flowTo.stat_energy_to;
          grid_productions.push(statId);
          const costId =
            flowTo.stat_compensation ||
            energyData.state.info.cost_sensors[statId];
          if (costId) {
            grid_productions_cost.push(costId);
          }
        });
      });

    printCategory(
      "grid_consumption",
      grid_consumptions,
      electricUnit,
      "grid_consumption_cost",
      grid_consumptions_cost
    );
    printCategory(
      "grid_return",
      grid_productions,
      electricUnit,
      "grid_return_compensation",
      grid_productions_cost
    );

    const battery_ins: string[] = [];
    const battery_outs: string[] = [];
    energy_sources
      .filter((s) => s.type === "battery")
      .forEach((source) => {
        source = source as BatterySourceTypeEnergyPreference;
        battery_ins.push(source.stat_energy_to);
        battery_outs.push(source.stat_energy_from);
      });

    printCategory("battery_in", battery_ins, electricUnit);
    printCategory("battery_out", battery_outs, electricUnit);

    const solar_productions: string[] = [];
    energy_sources
      .filter((s) => s.type === "solar")
      .forEach((source) => {
        source = source as SolarSourceTypeEnergyPreference;
        solar_productions.push(source.stat_energy_from);
      });

    printCategory("solar_production", solar_productions, electricUnit);

    const gas_consumptions: string[] = [];
    const gas_consumptions_cost: string[] = [];
    energy_sources
      .filter((s) => s.type === "gas")
      .forEach((source) => {
        source = source as GasSourceTypeEnergyPreference;
        const statId = source.stat_energy_from;
        gas_consumptions.push(statId);
        const costId =
          source.stat_cost || energyData.state.info.cost_sensors[statId];
        if (costId) {
          gas_consumptions_cost.push(costId);
        }
      });

    printCategory(
      "gas_consumption",
      gas_consumptions,
      gasUnit,
      "gas_consumption_cost",
      gas_consumptions_cost
    );

    const water_consumptions: string[] = [];
    const water_consumptions_cost: string[] = [];
    energy_sources
      .filter((s) => s.type === "water")
      .forEach((source) => {
        source = source as WaterSourceTypeEnergyPreference;
        const statId = source.stat_energy_from;
        water_consumptions.push(statId);
        const costId =
          source.stat_cost || energyData.state.info.cost_sensors[statId];
        if (costId) {
          water_consumptions_cost.push(costId);
        }
      });

    printCategory(
      "water_consumption",
      water_consumptions,
      waterUnit,
      "water_consumption_cost",
      water_consumptions_cost
    );

    const devices: string[] = [];
    device_consumption.forEach((source) => {
      source = source as DeviceConsumptionEnergyPreference;
      devices.push(source.stat_consumption);
    });

    printCategory("device_consumption", devices, electricUnit);

    const blob = new Blob(csv, {
      type: "text/csv",
    });
    const url = window.URL.createObjectURL(blob);
    fileDownload(url, "energy.csv");
  }

  private _reloadView() {
    // Force strategy to be re-run by make a copy of the view
    const config = this._lovelace!.config;
    this._lovelace = {
      ...this._lovelace!,
      config: { ...config, views: [{ ...config.views[0] }] },
    };
  }

  static get styles(): CSSResultGroup {
    return [
      haStyle,
      css`
        :host hui-energy-period-selector {
          flex-grow: 1;
          padding-left: 32px;
          padding-inline-start: 32px;
          padding-inline-end: initial;
          --disabled-text-color: rgba(var(--rgb-text-primary-color), 0.5);
          direction: var(--direction);
          --date-range-picker-max-height: calc(100vh - 80px);
        }
        :host([narrow]) hui-energy-period-selector {
          padding-left: 0px;
          padding-inline-start: 0px;
          padding-inline-end: initial;
        }
        :host {
          -ms-user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
        }
        .header {
          background-color: var(--app-header-background-color);
          color: var(--app-header-text-color, white);
          border-bottom: var(--app-header-border-bottom, none);
          position: fixed;
          top: 0;
          width: var(--mdc-top-app-bar-width, 100%);
          padding-top: env(safe-area-inset-top);
          z-index: 4;
          transition: box-shadow 200ms linear;
          display: flex;
          flex-direction: row;
          -webkit-backdrop-filter: var(--app-header-backdrop-filter, none);
          backdrop-filter: var(--app-header-backdrop-filter, none);
        }
        :host([scrolled]) .header {
          box-shadow: var(
            --mdc-top-app-bar-fixed-box-shadow,
            0px 2px 4px -1px rgba(0, 0, 0, 0.2),
            0px 4px 5px 0px rgba(0, 0, 0, 0.14),
            0px 1px 10px 0px rgba(0, 0, 0, 0.12)
          );
        }
        .toolbar {
          height: var(--header-height);
          display: flex;
          flex: 1;
          align-items: center;
          font-size: 20px;
          padding: 0px 12px;
          font-weight: 400;
          box-sizing: border-box;
        }
        @media (max-width: 599px) {
          .toolbar {
            padding: 0 4px;
          }
        }
        .main-title {
          margin: var(--margin-title);
          line-height: 20px;
          flex-grow: 1;
        }
        hui-view-container {
          position: relative;
          display: flex;
          min-height: 100vh;
          box-sizing: border-box;
          padding-top: calc(var(--header-height) + env(safe-area-inset-top));
          padding-left: env(safe-area-inset-left);
          padding-right: env(safe-area-inset-right);
          padding-inline-start: env(safe-area-inset-left);
          padding-inline-end: env(safe-area-inset-right);
          padding-bottom: env(safe-area-inset-bottom);
        }
        hui-view {
          flex: 1 1 100%;
          max-width: 100%;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-panel-energy": PanelEnergy;
  }
}

declare global {
  interface HASSDomEvents {
    "reload-energy-panel": undefined;
  }
}
