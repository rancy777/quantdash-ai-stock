// Tushare API集成测试脚本
// 这个脚本用于测试Tushare API连接和数据获取功能

// 模拟浏览器环境中的fetch API
const fetch = require('node-fetch');

// 模拟import.meta.env
global.import.meta = {
  env: {
    TUSHARE_API_KEY: 'YOUR_TUSHARE_API_KEY_HERE', // 请替换为实际的API密钥
    TUSHARE_API_BASE_URL: 'https://api.tushare.pro'
  }
};

// 模拟console对象
global.console = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

// 模拟浏览器环境中的类型
class SentimentEntry {
  constructor() {
    this.date = '';
    this.value = 0;
    this.height = 0;
    this.limitUpCount = 0;
    this.limitDownCount = 0;
    this.riseCount = 0;
  }
}

global.SentimentEntry = SentimentEntry;

// Tushare API响应接口
function testTushareConnection() {
  const apiKey = global.import.meta.env.TUSHARE_API_KEY;
  const baseUrl = global.import.meta.env.TUSHARE_API_BASE_URL;
  
  console.log(`测试Tushare API连接: ${baseUrl}`);
  console.log(`使用API密钥: ${apiKey.substring(0, 4)}****`);
  
  const params = new URLSearchParams({
    api_name: 'stock_basic',
    token: apiKey,
    params: JSON.stringify({
      exchange: '',
      list_status: 'L',
      fields: 'ts_code,symbol,name,area,industry,list_date',
      limit: 1
    })
  });
  
  return fetch(`${baseUrl}?${params}`)
    .then(response => response.json())
    .then(data => {
      if (data.code === '0') {
        console.log('✅ Tushare API连接成功!');
        console.log('返回的示例数据:', data.data?.items?.[0]);
        return true;
      } else {
        console.error('❌ Tushare API连接失败:', data.message);
        return false;
      }
    })
    .catch(error => {
      console.error('❌ Tushare API连接异常:', error.message);
      return false;
    });
}

// 测试市场宽度数据获取
function testMarketBreadth() {
  const apiKey = global.import.meta.env.TUSHARE_API_KEY;
  const baseUrl = global.import.meta.env.TUSHARE_API_BASE_URL;
  
  // 使用今天的日期（格式化为YYYYMMDD）
  const today = new Date();
  const date = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  console.log(`测试获取市场宽度数据 (日期: ${date})`);
  
  const params = new URLSearchParams({
    api_name: 'market_breadth',
    token: apiKey,
    params: JSON.stringify({
      trade_date: date,
      fields: 'trade_date,ts_code,name,pct_chg,vol,amount'
    })
  });
  
  return fetch(`${baseUrl}?${params}`)
    .then(response => response.json())
    .then(data => {
      if (data.code !== '0') {
        console.error('❌ 获取市场宽度数据失败:', data.message);
        return null;
      }
      
      if (!data.data?.items || data.data.items.length === 0) {
        console.warn('⚠️  市场宽度数据为空，可能是非交易日');
        return null;
      }
      
      // 计算上涨、下跌和平盘家数
      let rise = 0;
      let fall = 0;
      let flat = 0;
      
      const pctChgIndex = data.data.fields.indexOf('pct_chg');
      
      if (pctChgIndex === -1) {
        console.error('❌ 返回数据中找不到pct_chg字段');
        return null;
      }
      
      for (const item of data.data.items) {
        const pctChg = parseFloat(item[pctChgIndex]) || 0;
        if (pctChg > 0) rise++;
        else if (pctChg < 0) fall++;
        else flat++;
      }
      
      const result = { rise, fall, flat };
      console.log('✅ 成功获取市场宽度数据:', result);
      console.log(`上涨家数: ${rise}, 下跌家数: ${fall}, 平盘家数: ${flat}`);
      
      return result;
    })
    .catch(error => {
      console.error('❌ 获取市场宽度数据异常:', error.message);
      return null;
    });
}

// 测试交易日历获取
function testTradeCalendar() {
  const apiKey = global.import.meta.env.TUSHARE_API_KEY;
  const baseUrl = global.import.meta.env.TUSHARE_API_BASE_URL;
  
  // 获取最近30天的交易日历
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const endDateStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');
  const startDateStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');
  
  console.log(`测试获取交易日历 (${startDateStr} 到 ${endDateStr})`);
  
  const params = new URLSearchParams({
    api_name: 'trade_cal',
    token: apiKey,
    params: JSON.stringify({
      start_date: startDateStr,
      end_date: endDateStr,
      fields: 'cal_date,is_open'
    })
  });
  
  return fetch(`${baseUrl}?${params}`)
    .then(response => response.json())
    .then(data => {
      if (data.code !== '0') {
        console.error('❌ 获取交易日历失败:', data.message);
        return null;
      }
      
      if (!data.data?.items || data.data.items.length === 0) {
        console.warn('⚠️  交易日历数据为空');
        return null;
      }
      
      const tradeDates = data.data.items
        .filter(item => item[1] === 1) // 只获取交易日
        .map(item => item[0]);
      
      console.log(`✅ 成功获取交易日历，最近的5个交易日:`);
      tradeDates.slice(-5).forEach(date => {
        // 格式化日期显示
        const formattedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
        console.log(`  - ${formattedDate}`);
      });
      
      return tradeDates;
    })
    .catch(error => {
      console.error('❌ 获取交易日历异常:', error.message);
      return null;
    });
}

// 运行所有测试
async function runAllTests() {
  console.log('===================== Tushare API 集成测试 =====================');
  
  // 检查是否已安装node-fetch
  if (!fetch) {
    console.error('❌ 请先安装node-fetch: npm install node-fetch --save-dev');
    return;
  }
  
  // 检查API密钥
  const apiKey = global.import.meta.env.TUSHARE_API_KEY;
  if (apiKey === 'YOUR_TUSHARE_API_KEY_HERE') {
    console.warn('⚠️  请在.env.local文件中设置实际的Tushare API密钥');
  }
  
  // 运行测试
  console.log('\n1. 测试API连接...');
  const connectionSuccess = await testTushareConnection();
  
  if (connectionSuccess) {
    console.log('\n2. 测试获取市场宽度数据...');
    await testMarketBreadth();
    
    console.log('\n3. 测试获取交易日历...');
    await testTradeCalendar();
  }
  
  console.log('\n===================== 测试完成 =====================');
  console.log('提示: 要运行此测试脚本，请执行以下命令:');
  console.log('      node scripts/testTushareIntegration.js');
  console.log('注意: 确保已安装node-fetch: npm install node-fetch --save-dev');
}

// 运行测试
runAllTests();