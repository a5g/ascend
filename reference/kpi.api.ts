import { APIRequestContext } from '@playwright/test'
import qs from 'qs'

import { API } from './index'
import config from '../config'
import { utils } from '../utils/utils'

const cookies = require('../cookies.json')

const BUY_PRICE_INCREASE = 1.0025
const SELL_PRICE_DECREASE = 0.9975

export class KiteAPI extends API {
  request: APIRequestContext

  /**
   * Constructs a new KiteAPI instance with the provided APIRequestContext.
   *
   * @param request - The APIRequestContext to use for making API requests.
   */
  constructor(request: APIRequestContext) {
    super(request)
    this.request = request
  }

  public getFutureDate() {
    const today = new Date()

    // Add 1 year
    const futureDate = new Date(today)
    futureDate.setFullYear(today.getFullYear() + 1)

    // Format as YYYY-MM-DD HH:MM:SS
    const yyyy = futureDate.getFullYear()
    const mm = String(futureDate.getMonth() + 1).padStart(2, '0') // months are 0-based
    const dd = String(futureDate.getDate() - 1).padStart(2, '0')
    const HH = '00'
    const MM = '00'
    const SS = '00'

    return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`
  }

  public getGTTOrderData(order: any) {
    const lastPrice =
      order.transactionType === 'BUY' ? order.buyPrice : order.sellPrice
    const triggerPrice = utils.zerodaPriceFormat(lastPrice * 1.003)
    // order.transactionType === 'BUY'
    //   ? utils.zerodaPriceFormat(order.buyPrice * 1.0025)
    //   : utils.zerodaPriceFormat(order.sellPrice * 1.0025)

    // const executionPrice = utils.zerodaPriceFormat(triggerPrice * 1.01)

    const executionPrice =
      order.transactionType === 'BUY'
        ? utils.zerodaPriceFormat(triggerPrice * BUY_PRICE_INCREASE)
        : utils.zerodaPriceFormat(triggerPrice * SELL_PRICE_DECREASE)
    // const executionPrice = utils.zerodaPriceFormat(order.ltp * 1.01)

    // console.log(`trigger price: ${triggerPrice}`)
    // console.log(`LAST PRICE: ${LAST_PRICE}`)
    const data = qs.stringify({
      condition: `{"exchange":"${order.exchange}","tradingsymbol":"${order.tradingSymbol}","trigger_values":[${triggerPrice}],"last_price":${lastPrice}}`,
      orders: `[{"exchange":"${order.exchange}","tradingsymbol":"${order.tradingSymbol}","transaction_type":"${order.transactionType}","quantity":${order.qty},"price":${executionPrice},"order_type":"LIMIT","product":"CNC"}]`,
      type: 'single',
      expires_at: this.getFutureDate(),
    })

    // console.log(`Transaction Type: ${order.transactionType}`)
    // console.log(`LTP: ${lastPrice}`)
    // console.log(`Trigger Price: ${triggerPrice}`)
    // console.log(`execution Price: ${executionPrice}`)

    return data
  }

  public getOCOOrderData(order: any) {
    const stoplossTriggerPrice = utils.zerodaPriceFormat(order.stoplossPrice)
    const stoplossPrice = utils.zerodaPriceFormat(
      order.stoplossPrice * SELL_PRICE_DECREASE,
    )
    const targetTriggerPrice = utils.zerodaPriceFormat(order.targetPrice)
    const targetPrice = utils.zerodaPriceFormat(
      order.targetPrice * SELL_PRICE_DECREASE,
    )

    const data = qs.stringify({
      condition: `{"exchange":"${order.exchange}","tradingsymbol":"${order.tradingSymbol}","trigger_values":[${stoplossTriggerPrice}, ${targetTriggerPrice}],"last_price":${order.ltp}}`,
      orders: `[{"exchange":"${order.exchange}","tradingsymbol":"${order.tradingSymbol}","transaction_type":"${order.transactionType}","quantity":${order.qty},"price":${stoplossPrice},"order_type":"LIMIT","product":"CNC"},{"exchange":"${order.exchange}","tradingsymbol":"${order.tradingSymbol}","transaction_type":"${order.transactionType}","quantity":${order.qty},"price":${targetPrice},"order_type":"LIMIT","product":"CNC"}]`,
      type: 'two-leg',
      expires_at: this.getFutureDate(),
    })

    return data
  }

  public async getLTP({ exchange, tradingsymbol }) {
    const request: any = {
      url: `${config.apiHost}/quote/ltp?i=${exchange}:${tradingsymbol}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `enctoken ${cookies[utils.kiteuser().kcid]}`,
      },
    }

    return super.get(request)
  }

  public async placeGTTOld(order: any) {
    const data = this.getGTTOrderData(order)
    const request: any = {
      url: `${config.apiHost}/oms/gtt/triggers`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `enctoken ${cookies[utils.kiteuser().kcid]}`,
      },
      data,
    }

    return super.post(request)
  }

  public async placeOCO(order: any) {
    const data = this.getOCOOrderData(order)
    const request: any = {
      url: `${config.apiHost}/oms/gtt/triggers`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `enctoken ${cookies[utils.kiteuser().kcid]}`,
      },
      data,
    }

    return super.post(request)
  }

  public async placeRegularOrder(payload: any) {
    // console.log(payload)
    // console.log(utils.kiteuser(payload.kcid).kiteid)
    const data = qs.stringify({
      variety: 'regular',
      exchange: payload.exchange,
      tradingsymbol: payload.tradingSymbol,
      transaction_type: payload.transactionType,
      order_type: payload.order_type,
      quantity: payload.qty,
      price: utils.zerodaPriceFormat(payload.price),
      product: 'CNC',
      validity: 'DAY',
      disclosed_quantity: 0,
      trigger_price: 0,
      squareoff: 0,
      stoploss: 0,
      trailing_stoploss: 0,
      // user_id: utils.kiteuser().kiteid,
      user_id: utils.kiteuser(payload.kcid).kiteid,
      // user_id: payload.kcid,
    })

    const request: any = {
      url: `${config.apiHost}/oms/orders/regular`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `enctoken ${cookies[payload.kcid]}`,
      },
      data,
    }

    return super.post(request)
  }

  public async placeGTT(payload: any) {
    const data = this.getGTTOrderData(payload)
    const request: any = {
      url: `${config.apiHost}/oms/gtt/triggers`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `enctoken ${cookies[payload.kcid]}`,
      },
      data,
    }

    // console.log(JSON.parse(data))

    return super.post(request)
  }

  public async placeAMO(payload: any) {
    const data = qs.stringify({
      variety: 'regular',
      exchange: payload.exchange,
      tradingsymbol: payload.tradingSymbol,
      transaction_type: payload.transactionType,
      order_type: payload.order_type,
      quantity: payload.qty,
      price: utils.zerodaPriceFormat(payload.price),
      product: 'CNC',
      validity: 'DAY',
      disclosed_quantity: 0,
      trigger_price: 0,
      squareoff: 0,
      stoploss: 0,
      trailing_stoploss: 0,
      user_id: utils.kiteuser(payload.kcid).kiteid,
      tag: 'switch_to_amo',
    })

    const request: any = {
      url: `${config.apiHost}/oms/orders/amo`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `enctoken ${cookies[payload.kcid]}`,
      },
      data,
    }

    return super.post(request)
  }

  public async getRegularOpenOrders(tradingSymbol: string = '') {
    const request: any = {
      url: `${config.apiHost}/oms/orders`,
      method: 'GET',
      headers: {
        Authorization: `enctoken ${cookies[utils.kiteuser().kcid]}`,
      },
    }

    const orders: any = await super.get(request)

    if (tradingSymbol !== '') {
      return orders.data.data.filter(
        (order) =>
          order.status === 'OPEN' && order.tradingsymbol === tradingSymbol,
      )
    }

    return []

    // return orders.data.data.filter((order) => order.status === 'OPEN')
  }

  public async getAMOOpenOrders(tradingSymbol: string = '') {
    const request: any = {
      url: `${config.apiHost}/oms/orders`,
      method: 'GET',
      headers: {
        Authorization: `enctoken ${cookies[utils.kiteuser().kcid]}`,
      },
    }

    const orders: any = await super.get(request)

    if (tradingSymbol !== '') {
      return orders.data.data.filter(
        (order) =>
          order.status === 'AMO REQ RECEIVED' &&
          order.tradingsymbol === tradingSymbol,
      )
    }

    return []
    // return orders.data.data.filter(
    //   (order) => order.status === 'AMO REQ RECEIVED',
    // )
  }

  public async getGTTActiveOrders(tradingSymbol: string = '') {
    const request: any = {
      url: `${config.apiHost}/oms/gtt/triggers`,
      method: 'GET',
      headers: {
        Authorization: `enctoken ${cookies[utils.kiteuser().kcid]}`,
      },
    }

    const orders: any = await super.get(request)

    if (tradingSymbol !== '') {
      return orders.data.data.filter(
        (order) =>
          order.status === 'active' &&
          order.condition.tradingsymbol === tradingSymbol &&
          order.type === 'single',
      )
    }

    return []

    // return orders.data.data.filter((order) => order.status === 'active')
  }

  public async getGTTOrders(kcid: number) {
    const request: any = {
      url: `${config.apiHost}/oms/gtt/triggers`,
      method: 'GET',
      headers: {
        Authorization: `enctoken ${cookies[kcid]}`,
      },
    }

    const orders: any = await super.get(request)

    return orders
  }

  public async getOCOActiveOrders(tradingSymbol: string = '') {
    const request: any = {
      url: `${config.apiHost}/oms/gtt/triggers`,
      method: 'GET',
      headers: {
        Authorization: `enctoken ${cookies[utils.kiteuser().kcid]}`,
      },
    }

    const orders: any = await super.get(request)

    if (tradingSymbol !== '') {
      return orders.data.data.filter(
        (order) =>
          order.status === 'active' &&
          order.condition.tradingsymbol === tradingSymbol &&
          order.type === 'two-leg',
      )
    }

    return []

    // return orders.data.data.filter((order) => order.status === 'active')
  }

  public async cancelGTTOrder(id: number) {
    const request: any = {
      url: `${config.apiHost}/oms/gtt/triggers/${id}`,
      method: 'DELETE',
      headers: {
        Authorization: `enctoken ${cookies[utils.kiteuser().kcid]}`,
      },
    }

    return super.delete(request)
  }

  public async cancelRegularOrder(id: number) {
    const request: any = {
      url: `${config.apiHost}/oms/orders/regular/${id}?order_id=${id}&parent_order_id=&variety=regular`,
      method: 'DELETE',
      headers: {
        Authorization: `enctoken ${cookies[utils.kiteuser().kcid]}`,
      },
    }

    return super.delete(request)
  }

  public async cancelAMOOrder(id: number) {
    const request: any = {
      url: `${config.apiHost}/oms/orders/amo/${id}?order_id=${id}&parent_order_id=&variety=regular`,
      method: 'DELETE',
      headers: {
        Authorization: `enctoken ${cookies[utils.kiteuser().kcid]}`,
      },
    }

    return super.delete(request)
  }

  public async getHoldings(id: number = 1) {
    const request: any = {
      url: `${config.apiHost}/oms/portfolio/holdings`,
      method: 'GET',
      headers: {
        Authorization: `enctoken ${cookies[id]}`,
      },
    }

    return super.get(request)
  }

  public async getPositions(id: number = 1) {
    const request: any = {
      url: `${config.apiHost}/oms/portfolio/positions`,
      method: 'GET',
      headers: {
        Authorization: `enctoken ${cookies[id]}`,
      },
    }

    return super.get(request)
  }

  // public async placeAlert(order: any) {
  //   const data = qs.stringify({
  //     name: order.tradingSymbol,
  //     lhs_exchange: order.exchange,
  //     lhs_tradingsymbol: order.tradingSymbol,
  //     lhs_attribute: 'LastTradedPrice',
  //     operator: order.operator,
  //     rhs_type: 'constant',
  //     type: 'simple',
  //     rhs_constant: order.alertPrice,
  //   })

  //   const request: any = {
  //     url: `${config.apiHost}/oms/alerts`,
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/x-www-form-urlencoded',
  //       Authorization: `enctoken ${cookies[utils.kiteuser().kcid]}`,
  //     },
  //     data,
  //   }

  //   return super.post(request)
  // }

  public async placeAlert(order: any, kcid = 1) {
    const data = qs.stringify({
      name: order.tradingSymbol,
      lhs_exchange: order.exchange,
      lhs_tradingsymbol: order.tradingSymbol,
      lhs_attribute: 'LastTradedPrice',
      operator: order.operator,
      rhs_type: 'constant',
      type: 'simple',
      rhs_constant: order.alertPrice,
    })

    const request: any = {
      url: `${config.apiHost}/oms/alerts`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `enctoken ${cookies[kcid]}`,
      },
      data,
    }

    return super.post(request)
  }

  public async getActiveAlerts(tradingSymbol: string = '') {
    const request: any = {
      url: `${config.apiHost}/oms/alerts`,
      method: 'GET',
      headers: {
        Authorization: `enctoken ${cookies[utils.kiteuser().kcid]}`,
      },
    }

    const alerts: any = await super.get(request)

    if (tradingSymbol !== '') {
      return alerts.data.data.filter(
        (alert) => alert.lhs_tradingsymbol === tradingSymbol,
      )
    }

    return []
  }

  public async getAlerts() {
    const request: any = {
      url: `${config.apiHost}/oms/alerts`,
      method: 'GET',
      headers: {
        Authorization: `enctoken ${cookies[utils.kiteuser().kcid]}`,
      },
    }

    const alerts: any = await super.get(request)

    // if (tradingSymbol !== '') {
    //   return alerts.data.data.filter(
    //     (alert) => alert.lhs_tradingsymbol === tradingSymbol,
    //   )
    // }

    return alerts.data.data
  }

  public async deleteAlert(uuid: number, kcid = 1) {
    const request: any = {
      url: `${config.apiHost}/oms/alerts?uuid=${uuid}`,
      method: 'DELETE',
      headers: {
        Authorization: `enctoken ${cookies[kcid]}`,
      },
    }

    return super.delete(request)
  }
}