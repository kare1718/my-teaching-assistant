const STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID || 'store-test';
const CHANNEL_KEY = import.meta.env.VITE_PORTONE_CHANNEL_KEY || 'channel-key-test';

function generateId(prefix = 'pay') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function requestPayment(amount, orderName, customerName) {
  if (!window.PortOne) {
    throw new Error('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
  }

  const paymentId = generateId('pay');
  const response = await window.PortOne.requestPayment({
    storeId: STORE_ID,
    channelKey: CHANNEL_KEY,
    paymentId,
    orderName,
    totalAmount: amount,
    currency: 'CURRENCY_KRW',
    payMethod: 'CARD',
    customer: { fullName: customerName },
  });

  if (response.code) {
    if (response.code === 'FAILURE_TYPE_PG') {
      throw new Error(response.message || '결제가 실패했습니다.');
    }
    throw new Error(response.message || '결제가 취소되었습니다.');
  }

  return { paymentId };
}

export async function requestBillingKey(customerName) {
  if (!window.PortOne) {
    throw new Error('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
  }

  const issueId = generateId('bill');
  const response = await window.PortOne.requestIssueBillingKey({
    storeId: STORE_ID,
    channelKey: CHANNEL_KEY,
    issueName: '정기결제 등록',
    issueId,
    customer: { fullName: customerName },
  });

  if (response.code) {
    throw new Error(response.message || '빌링키 발급이 취소되었습니다.');
  }

  return { billingKey: response.billingKey };
}
