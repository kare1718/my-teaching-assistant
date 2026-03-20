const https = require('https');
const crypto = require('crypto');

const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || '';
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || '';
const SOLAPI_SENDER = process.env.SOLAPI_SENDER || '';

function getAuthHeader() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString('hex');
  const signature = crypto.createHmac('sha256', SOLAPI_API_SECRET)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

function sendSMS(to, text) {
  return new Promise((resolve, reject) => {
    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !SOLAPI_SENDER) {
      return reject(new Error('SMS 설정이 되어있지 않습니다. 환경변수를 확인해주세요.'));
    }

    const phone = to.replace(/[^0-9]/g, '');
    if (!phone || phone.length < 10) {
      return reject(new Error('유효하지 않은 전화번호입니다.'));
    }

    const body = JSON.stringify({
      message: {
        to: phone,
        from: SOLAPI_SENDER,
        text: text
      }
    });

    const options = {
      hostname: 'api.solapi.com',
      path: '/messages/v4/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(),
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || parsed.errorMessage || 'SMS 전송 실패'));
          }
        } catch (e) {
          reject(new Error('SMS API 응답 파싱 실패'));
        }
      });
    });

    req.on('error', (e) => reject(new Error('SMS 전송 중 오류: ' + e.message)));
    req.write(body);
    req.end();
  });
}

function sendBulkSMS(recipients, text) {
  return new Promise((resolve, reject) => {
    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !SOLAPI_SENDER) {
      return reject(new Error('SMS 설정이 되어있지 않습니다.'));
    }

    const messages = recipients.map(to => ({
      to: to.replace(/[^0-9]/g, ''),
      from: SOLAPI_SENDER,
      text: text
    })).filter(m => m.to.length >= 10);

    if (messages.length === 0) {
      return reject(new Error('유효한 수신 번호가 없습니다.'));
    }

    const body = JSON.stringify({ messages });

    const options = {
      hostname: 'api.solapi.com',
      path: '/messages/v4/send-many',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(),
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || parsed.errorMessage || 'SMS 대량 전송 실패'));
          }
        } catch (e) {
          reject(new Error('SMS API 응답 파싱 실패'));
        }
      });
    });

    req.on('error', (e) => reject(new Error('SMS 전송 중 오류: ' + e.message)));
    req.write(body);
    req.end();
  });
}

function isConfigured() {
  return !!(SOLAPI_API_KEY && SOLAPI_API_SECRET && SOLAPI_SENDER);
}

module.exports = { sendSMS, sendBulkSMS, isConfigured };
