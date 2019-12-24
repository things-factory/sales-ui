import '@things-factory/form-ui'
import '@things-factory/grist-ui'
import { getCodeByName } from '@things-factory/code-base'
import { i18next, localize } from '@things-factory/i18n-base'
import { openImportPopUp } from '@things-factory/import-ui'
import { client, CustomAlert, gqlBuilder, isMobileDevice, PageView, ScrollbarStyles } from '@things-factory/shell'
import gql from 'graphql-tag'
import { css, html } from 'lit-element'

class VasList extends localize(i18next)(PageView) {
  static get properties() {
    return {
      config: Object,
      data: Object
    }
  }

  static get styles() {
    return [
      ScrollbarStyles,
      css`
        :host {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        search-form {
          overflow: visible;
        }
        data-grist {
          overflow-y: auto;
          flex: 1;
        }
      `
    ]
  }

  render() {
    return html`
      <search-form .fields=${this._searchFields} @submit=${e => this.dataGrist.fetch()}></search-form>

      <data-grist
        .mode=${isMobileDevice() ? 'LIST' : 'GRID'}
        .config=${this.config}
        .fetchHandler="${this.fetchHandler.bind(this)}"
      ></data-grist>
    `
  }

  get context() {
    return {
      title: i18next.t('title.vas'),
      actions: [
        {
          title: i18next.t('button.save'),
          action: () => this._saveVas(this.dataGrist.exportPatchList({ flagName: 'cuFlag' }))
        },
        {
          title: i18next.t('button.delete'),
          action: this._deleteVas.bind(this)
        }
      ],
      exportable: {
        name: i18next.t('title.vas'),
        data: this._exportableData.bind(this)
      },
      importable: {
        handler: records => {
          const config = {
            rows: this.config.rows,
            columns: [...this.config.columns.filter(column => column.imex !== undefined)]
          }
          openImportPopUp(records, config, async patches => {
            await this._saveVas(patches)
            history.back()
          })
        }
      }
    }
  }

  get searchForm() {
    return this.shadowRoot.querySelector('search-form')
  }

  get dataGrist() {
    return this.shadowRoot.querySelector('data-grist')
  }

  async pageInitialized() {
    this._currencyTypes = await getCodeByName('CURRENCY_TYPES')

    this._searchFields = [
      {
        label: i18next.t('field.name'),
        name: 'name',
        type: 'text',
        props: { searchOper: 'i_like' }
      },
      {
        label: i18next.t('field.description'),
        name: 'description',
        type: 'text',
        props: { searchOper: 'i_like' }
      }
    ]

    this.config = {
      rows: { selectable: { multiple: true } },
      columns: [
        { type: 'gutter', gutterName: 'dirty' },
        { type: 'gutter', gutterName: 'sequence' },
        { type: 'gutter', gutterName: 'row-selector', multiple: true },
        {
          type: 'string',
          name: 'name',
          header: i18next.t('field.name'),
          record: { editable: true, align: 'left' },
          imex: { header: i18next.t('field.name'), key: 'name', width: 50, type: 'string' },
          sortable: true,
          width: 150
        },
        {
          type: 'string',
          name: 'description',
          header: i18next.t('field.description'),
          record: { editable: true, align: 'left' },
          imex: { header: i18next.t('field.description'), key: 'description', width: 50, type: 'string' },
          sortable: true,
          width: 200
        },
        {
          type: 'string',
          name: 'operationGuideType',
          header: i18next.t('field.operation_guide_type'),
          record: { editable: true, align: 'center' },
          imex: {
            header: i18next.t('field.operation_guide_type'),
            key: 'operationGuideType',
            width: 50,
            type: 'string'
          },
          sortable: true,
          width: 160
        },
        {
          type: 'string',
          name: 'operationGuide',
          header: i18next.t('field.operation_guide'),
          record: { editable: true, align: 'center' },
          imex: { header: i18next.t('field.operation_guide'), key: 'operationGuide', width: 50, type: 'string' },
          sortable: true,
          width: 160
        },
        {
          type: 'string',
          name: 'uom',
          header: i18next.t('field.uom'),
          record: { editable: true, align: 'left' },
          imex: { header: i18next.t('field.uom'), key: 'uom', width: 50, type: 'string' },
          sortable: true,
          width: 160
        },
        {
          type: 'code',
          name: 'currency',
          header: i18next.t('field.currency'),
          record: {
            editable: true,
            align: 'center',
            codeName: 'CURRENCY_TYPES'
          },
          imex: {
            header: i18next.t('field.currency'),
            key: 'currency',
            width: 50,
            type: 'array',
            arrData: this._currencyTypes.map(_currencyType => {
              return {
                name: _currencyType.name,
                id: _currencyType.name
              }
            })
          },
          sortable: true,
          width: 100
        },
        {
          type: 'float',
          name: 'defaultPrice',
          header: i18next.t('field.default_price'),
          record: { editable: true, align: 'center' },
          imex: { header: i18next.t('field.default_price'), key: 'defaultPrice', width: 50, type: 'float' },
          sortable: true,
          width: 60
        },
        {
          type: 'datetime',
          name: 'updatedAt',
          header: i18next.t('field.updated_at'),
          record: { editable: false, align: 'center' },
          sortable: true,
          width: 150
        },
        {
          type: 'object',
          name: 'updater',
          header: i18next.t('field.updater'),
          record: { editable: false, align: 'center' },
          sortable: true,
          width: 150
        }
      ]
    }
  }

  pageUpdated(_changes, _lifecycle) {
    if (this.active) {
      this.dataGrist.fetch()
    }
  }

  async fetchHandler({ page, limit, sorters = [{ name: 'name' }] }) {
    const response = await client.query({
      query: gql`
        query {
          vass(${gqlBuilder.buildArgs({
            filters: this.searchForm.queryFilters,
            pagination: { page, limit },
            sortings: sorters
          })}) {
            items {
              id
              name
              description
              defaultPrice
              currency
              uom
              operationGuideType
              operationGuide
              updatedAt
              updater{
                name
                description
              }
            }
            total
          }
        }
      `
    })

    return {
      total: response.data.vass.total || 0,
      records: response.data.vass.items || []
    }
  }

  async _saveVas(patches) {
    if (patches && patches.length) {
      patches.map(vas => {
        if (vas.defaultPrice) {
          vas.defaultPrice = parseFloat(vas.defaultPrice)
        }
      })

      const response = await client.query({
        query: gql`
          mutation {
            updateMultipleVas(${gqlBuilder.buildArgs({
              patches
            })}) {
              name
            }
          }
        `
      })

      if (!response.errors) {
        this.dataGrist.fetch()
        this.showToast(i18next.t('text.data_updated_successfully'))
      }
    } else {
      CustomAlert({
        title: i18next.t('text.nothing_changed'),
        text: i18next.t('text.there_is_nothing_to_save')
      })
    }
  }

  async _deleteVas() {
    const ids = this.dataGrist.selected.map(record => record.id)
    if (ids && ids.length) {
      const anwer = await CustomAlert({
        type: 'warning',
        title: i18next.t('button.delete'),
        text: i18next.t('text.are_you_sure'),
        confirmButton: { text: i18next.t('button.delete') },
        cancelButton: { text: i18next.t('button.cancel') }
      })

      if (!anwer.value) return

      const response = await client.query({
        query: gql`
        mutation {
          deleteVass(${gqlBuilder.buildArgs({ ids })})
        }
      `
      })

      if (!response.errors) {
        this.dataGrist.fetch()
        this.showToast(i18next.t('text.data_deleted_successfully'))
      }
    } else {
      CustomAlert({
        title: i18next.t('text.nothing_selected'),
        text: i18next.t('text.there_is_nothing_to_delete')
      })
    }
  }

  _exportableData() {
    let records = []
    if (this.dataGrist.selected && this.dataGrist.selected.length > 0) {
      records = this.dataGrist.selected
    } else {
      records = this.dataGrist.data.records
    }

    var headerSetting = this.dataGrist._config.columns
      .filter(column => column.type !== 'gutter' && column.record !== undefined && column.imex !== undefined)
      .map(column => {
        return column.imex
      })

    var data = records.map(item => {
      return {
        id: item.id,
        ...this.config.columns
          .filter(column => column.type !== 'gutter' && column.record !== undefined && column.imex !== undefined)
          .reduce((record, column) => {
            record[column.imex.key] = column.imex.key
              .split('.')
              .reduce((obj, key) => (obj && obj[key] !== 'undefined' ? obj[key] : undefined), item)
            return record
          }, {})
      }
    })

    return { header: headerSetting, data: data }
  }

  showToast(message) {
    document.dispatchEvent(new CustomEvent('notify', { detail: { message } }))
  }
}

window.customElements.define('vas-list', VasList)
