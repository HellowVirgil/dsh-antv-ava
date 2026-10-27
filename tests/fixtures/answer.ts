import type { AnswerDocument } from '../../src/protocol/types.ts'
export function answer(): AnswerDocument {
  return {
    schemaVersion:1, id:'answer-1', revision:0, source:'analysis', language:'zh-CN', title:'产品收入',
    results:[{
      id:'result-1', datasetId:'dataset-1', datasetVersion:'v1', queryId:'query-1',
      columns:[{id:'product',logicalType:'string'},{id:'revenue',logicalType:'number'}],
      rows:[{product:'A',revenue:20},{product:'B',revenue:4}], rowKeys:['0','1'], returnedRows:2, totalRows:2,
      truncated:false, executedAt:'2026-10-26T00:00:00Z', executionRef:'execution-1',
      evidence:{source:'sales.csv', query:'SELECT product, SUM(revenue) AS revenue FROM data GROUP BY product'},
    }],
    views:[{id:'chart',resultId:'result-1',chartType:'bar',bindings:{category:'product',value:'revenue'}}],
    blocks:[
      {id:'text',kind:'paragraph',phrases:[{kind:'text',text:'A 的收入为 '},{kind:'value',ref:{resultId:'result-1',rowKey:'0',columnId:'revenue'},format:'number'}]},
      {id:'chart',kind:'chart',viewId:'chart'},
    ],
  }
}
