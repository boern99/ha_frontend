import "@material/mwc-button/mwc-button";
import "@material/mwc-list/mwc-list";
import type { ActionDetail } from "@material/mwc-list/mwc-list-foundation";
import "@material/mwc-list/mwc-list-item";
import { mdiCalendar, mdiMagnifyPlus, mdiMagnifyMinus } from "@mdi/js";
import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  differenceInMilliseconds,
  addMilliseconds,
  subMilliseconds,
  roundToNearestHours,
  isFirstDayOfMonth,
  isLastDayOfMonth,
  subMonths,
  differenceInMonths,
  isThisYear,
} from "date-fns";
import type { CSSResultGroup, PropertyValues, TemplateResult } from "lit";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import { ifDefined } from "lit/directives/if-defined";
import { calcDate } from "../common/datetime/calc_date";
import { firstWeekdayIndex } from "../common/datetime/first_weekday";
import {
  formatShortDateTimeWithYear,
  formatShortDateTime,
} from "../common/datetime/format_date_time";
import { useAmPm } from "../common/datetime/use_am_pm";
import type { HomeAssistant } from "../types";
import "./date-range-picker";
import "./ha-icon-button";
import "./ha-textarea";
import "./ha-icon-button-next";
import "./ha-icon-button-prev";

export interface DateRangePickerRanges {
  [key: string]: [Date, Date];
}

@customElement("ha-date-range-picker")
export class HaDateRangePicker extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public startDate!: Date;

  @property({ attribute: false }) public endDate!: Date;

  @property({ attribute: false }) public ranges?: DateRangePickerRanges | false;

  @state() private _ranges?: DateRangePickerRanges;

  @property({ attribute: "auto-apply", type: Boolean })
  public autoApply = false;

  @property({ attribute: "time-picker", type: Boolean })
  public timePicker = true;

  @property({ type: Boolean }) public disabled = false;

  @property({ type: Boolean }) public minimal = false;

  @state() private _hour24format = false;

  @property({ attribute: "extended-presets", type: Boolean })
  public extendedPresets = false;

  @property({ attribute: false }) public openingDirection?:
    | "right"
    | "left"
    | "center"
    | "inline";

  @state() private _calcedOpeningDirection?:
    | "right"
    | "left"
    | "center"
    | "inline";

  protected willUpdate(changedProps: PropertyValues) {
    if (
      (!this.hasUpdated && this.ranges === undefined) ||
      (changedProps.has("hass") &&
        this.hass?.localize !== changedProps.get("hass")?.localize)
    ) {
      const today = new Date();
      const weekStartsOn = firstWeekdayIndex(this.hass.locale);
      const weekStart = calcDate(
        today,
        startOfWeek,
        this.hass.locale,
        this.hass.config,
        {
          weekStartsOn,
        }
      );
      const weekEnd = calcDate(
        today,
        endOfWeek,
        this.hass.locale,
        this.hass.config,
        {
          weekStartsOn,
        }
      );

      this._ranges = {
        [this.hass.localize("ui.components.date-range-picker.ranges.today")]: [
          calcDate(today, startOfDay, this.hass.locale, this.hass.config, {
            weekStartsOn,
          }),
          calcDate(today, endOfDay, this.hass.locale, this.hass.config, {
            weekStartsOn,
          }),
        ],
        [this.hass.localize(
          "ui.components.date-range-picker.ranges.yesterday"
        )]: [
          calcDate(
            addDays(today, -1),
            startOfDay,
            this.hass.locale,
            this.hass.config,
            {
              weekStartsOn,
            }
          ),
          calcDate(
            addDays(today, -1),
            endOfDay,
            this.hass.locale,
            this.hass.config,
            {
              weekStartsOn,
            }
          ),
        ],
        [this.hass.localize(
          "ui.components.date-range-picker.ranges.this_week"
        )]: [weekStart, weekEnd],
        ...(this.extendedPresets
          ? {
              [this.hass.localize(
                "ui.components.date-range-picker.ranges.this_month"
              )]: [
                calcDate(
                  today,
                  startOfMonth,
                  this.hass.locale,
                  this.hass.config,
                  {
                    weekStartsOn,
                  }
                ),
                calcDate(
                  today,
                  endOfMonth,
                  this.hass.locale,
                  this.hass.config,
                  {
                    weekStartsOn,
                  }
                ),
              ],
              [this.hass.localize(
                "ui.components.date-range-picker.ranges.this_year"
              )]: [
                calcDate(
                  today,
                  startOfYear,
                  this.hass.locale,
                  this.hass.config,
                  {
                    weekStartsOn,
                  }
                ),
                calcDate(today, endOfYear, this.hass.locale, this.hass.config, {
                  weekStartsOn,
                }),
              ],
            }
          : {}),
      };
    }
  }

  protected updated(changedProps: PropertyValues) {
    if (changedProps.has("hass")) {
      const oldHass = changedProps.get("hass") as HomeAssistant | undefined;
      if (!oldHass || oldHass.locale !== this.hass.locale) {
        this._hour24format = !useAmPm(this.hass.locale);
      }
    }
  }

  protected render(): TemplateResult {
    return html`
      <date-range-picker
        ?disabled=${this.disabled}
        ?auto-apply=${this.autoApply}
        time-picker=${this.timePicker}
        twentyfour-hours=${this._hour24format}
        start-date=${this.startDate.toISOString()}
        end-date=${this.endDate.toISOString()}
        ?ranges=${this.ranges !== false}
        opening-direction=${ifDefined(
          this.openingDirection || this._calcedOpeningDirection
        )}
        first-day=${firstWeekdayIndex(this.hass.locale)}
        language=${this.hass.locale.language}
      >
        <div slot="input" class="date-range-inputs" @click=${this._handleClick}>
          ${!this.minimal
            ? html`<ha-textarea
                  mobile2multiline
                  .value=${(isThisYear(this.startDate)
                    ? formatShortDateTime(
                        this.startDate,
                        this.hass.locale,
                        this.hass.config
                      )
                    : formatShortDateTimeWithYear(
                        this.startDate,
                        this.hass.locale,
                        this.hass.config
                      )) +
                  " - \n" +
                  (isThisYear(this.endDate)
                    ? formatShortDateTime(
                        this.endDate,
                        this.hass.locale,
                        this.hass.config
                      )
                    : formatShortDateTimeWithYear(
                        this.endDate,
                        this.hass.locale,
                        this.hass.config
                      ))}
                  .label=${this.hass.localize(
                    "ui.components.selectors.selector.types.datetime"
                  )}
                  .disabled=${this.disabled}
                  @click=${this._handleInputClick}
                  readonly
                ></ha-textarea>
                <ha-icon-button
                  @click=${this._handleZoomOut}
                  .label=${this.hass.localize(
                    "ui.components.date-range-picker.zoom_out"
                  )}
                  .path=${mdiMagnifyMinus}
                ></ha-icon-button>
                <ha-icon-button
                  @click=${this._handleZoomIn}
                  .label=${this.hass.localize(
                    "ui.components.date-range-picker.zoom_in"
                  )}
                  .path=${mdiMagnifyPlus}
                ></ha-icon-button>
                <ha-icon-button-prev
                  .label=${this.hass.localize("ui.common.previous")}
                  class="prev"
                  @click=${this._handlePrev}
                >
                </ha-icon-button-prev>
                <ha-icon-button-next
                  .label=${this.hass.localize("ui.common.next")}
                  class="next"
                  @click=${this._handleNext}
                >
                </ha-icon-button-next> `
            : html`<ha-icon-button
                .label=${this.hass.localize(
                  "ui.components.date-range-picker.select_date_range"
                )}
                .path=${mdiCalendar}
              ></ha-icon-button>`}
        </div>
        ${this.ranges !== false && (this.ranges || this._ranges)
          ? html`<div slot="ranges" class="date-range-ranges">
              <mwc-list @action=${this._setDateRange} activatable>
                ${Object.keys(this.ranges || this._ranges!).map(
                  (name) => html`<mwc-list-item>${name}</mwc-list-item>`
                )}
              </mwc-list>
            </div>`
          : nothing}
        <div slot="footer" class="date-range-footer">
          <mwc-button @click=${this._cancelDateRange}
            >${this.hass.localize("ui.common.cancel")}</mwc-button
          >
          <mwc-button @click=${this._applyDateRange}
            >${this.hass.localize(
              "ui.components.date-range-picker.select"
            )}</mwc-button
          >
        </div>
      </date-range-picker>
    `;
  }

  private _handleNext(): void {
    let dateRange: [Date, Date];
    if (isFirstDayOfMonth(this.startDate) && isLastDayOfMonth(this.endDate)) {
      dateRange = [
        roundToNearestHours(this.endDate),
        subMilliseconds(
          addMonths(
            roundToNearestHours(this.endDate),
            differenceInMonths(addMilliseconds(this.endDate, 1), this.startDate)
          ),
          1
        ),
      ];
    } else {
      dateRange = [
        roundToNearestHours(this.endDate),
        subMilliseconds(
          roundToNearestHours(
            addMilliseconds(
              this.endDate,
              Math.max(
                3600000,
                differenceInMilliseconds(this.endDate, this.startDate)
              )
            )
          ),
          1
        ),
      ];
    }
    const dateRangePicker = this._dateRangePicker;
    dateRangePicker.clickRange(dateRange);
    dateRangePicker.clickedApply();
  }

  private _handlePrev(): void {
    let dateRange: [Date, Date];
    if (isFirstDayOfMonth(this.startDate) && isLastDayOfMonth(this.endDate)) {
      dateRange = [
        subMonths(
          this.startDate,
          differenceInMonths(addMilliseconds(this.endDate, 1), this.startDate)
        ),
        subMilliseconds(roundToNearestHours(this.startDate), 1),
      ];
    } else {
      dateRange = [
        roundToNearestHours(
          subMilliseconds(
            this.startDate,
            Math.max(
              3600000,
              differenceInMilliseconds(this.endDate, this.startDate)
            )
          )
        ),
        subMilliseconds(roundToNearestHours(this.startDate), 1),
      ];
    }
    const dateRangePicker = this._dateRangePicker;
    dateRangePicker.clickRange(dateRange);
    dateRangePicker.clickedApply();
  }

  private _handleZoomOut(): void {
    const diff = differenceInMilliseconds(this.endDate, this.startDate) / 2;
    let dateRange: [Date, Date];
    dateRange = [
      roundToNearestHours(subMilliseconds(this.startDate, diff)),
      subMilliseconds(
        roundToNearestHours(addMilliseconds(this.endDate, diff + 2)),
        1
      ),
    ];

    const dateRangePicker = this._dateRangePicker;
    dateRangePicker.clickRange(dateRange);
    dateRangePicker.clickedApply();
  }

  private _handleZoomIn(): void {
    let dateRange: [Date, Date];
    var diff =
      differenceInMilliseconds(
        this.endDate > new Date() ? new Date() : this.endDate,
        this.startDate
      ) / 4;
    if (diff < 1 * 60 * 60 * 1000) {
      var diff = 0;
    }
    if (this.endDate > new Date()) {
      this.endDate = new Date();
      dateRange = [
        roundToNearestHours(addMilliseconds(this.startDate, diff)),
        subMilliseconds(roundToNearestHours(new Date()), 1),
      ];
    } else {
      dateRange = [
        roundToNearestHours(addMilliseconds(this.startDate, diff)),
        subMilliseconds(
          roundToNearestHours(subMilliseconds(this.endDate, diff)),
          1
        ),
      ];
    }
    const dateRangePicker = this._dateRangePicker;
    dateRangePicker.clickRange(dateRange);
    dateRangePicker.clickedApply();
  }

  private _setDateRange(ev: CustomEvent<ActionDetail>) {
    const dateRange = Object.values(this.ranges || this._ranges!)[
      ev.detail.index
    ];
    const dateRangePicker = this._dateRangePicker;
    dateRangePicker.clickRange(dateRange);
    dateRangePicker.clickedApply();
  }

  private _cancelDateRange() {
    this._dateRangePicker.clickCancel();
  }

  private _applyDateRange() {
    this._dateRangePicker.clickedApply();
  }

  private get _dateRangePicker() {
    const dateRangePicker = this.shadowRoot!.querySelector(
      "date-range-picker"
    ) as any;
    return dateRangePicker.vueComponent.$children[0];
  }

  private _handleInputClick() {
    // close the date picker, so it will open again on the click event
    if (this._dateRangePicker.open) {
      this._dateRangePicker.open = false;
    }
  }

  private _handleClick() {
    // calculate opening direction if not set
    if (!this._dateRangePicker.open && !this.openingDirection) {
      const datePickerPosition = this.getBoundingClientRect().x;
      let opens: "right" | "left" | "center" | "inline";
      if (datePickerPosition > (2 * window.innerWidth) / 3) {
        opens = "left";
      } else if (datePickerPosition < window.innerWidth / 3) {
        opens = "right";
      } else {
        opens = "center";
      }
      this._calcedOpeningDirection = opens;
    }
  }

  static get styles(): CSSResultGroup {
    return css`
      ha-icon-button-prev {
        margin-right:8px;
      }

      ha-icon-button {
        direction: var(--direction);
      }

      .date-range-inputs {
        display: flex;
        align-items: center;
      }

      .date-range-ranges {
        border-right: 1px solid var(--divider-color);
      }

      .date-range-footer {
        display: flex;
        justify-content: flex-end;
        padding: 8px;
        border-top: 1px solid var(--divider-color);
      }

      ha-textarea {
        display: inline-block;
        width: 340px;
        margin-right: 8px;
      }
      @media only screen and (max-width: 460px) {
      ha-textarea {
        width: 100%
      }

      @media only screen and (max-width: 800px) {
        .date-range-ranges {
          border-right: none;
          border-bottom: 1px solid var(--divider-color);
        }
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-date-range-picker": HaDateRangePicker;
  }
}
