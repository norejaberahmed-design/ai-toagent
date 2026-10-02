import { FieldProfile, PrimitiveType } from './types';

const DATE_REGEXES = [
  /^\d{4}-\d{2}-\d{2}$/,
  /^\d{4}\/\d{2}\/\d{2}$/,
  /^\d{2}\/\d{2}\/\d{4}$/,
  /^\d{2}-\d{2}-\d{4}$/,
];

const DATETIME_REGEXES = [
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/,
  /^\d{4}\/\d{2}\/\d{2}[T ]\d{2}:\d{2}:\d{2}/,
];

const DOC_ID_REGEXES = [
  /^[A-Z]{2,5}[-_]?\d{3,10}$/i,
  /^INV[-_]?\d+/i,
  /^ORD[-_]?\d+/i,
  /^PO[-_]?\d+/i,
  /^TX[-_]?\d+/i,
  /^CUST[-_]?\d+/i,
  /^PRD[-_]?\d+/i,
  /^فاتورة[-_]?\d+/i,
  /^طلب[-_]?\d+/i,
];

const CURRENCY_SYMBOLS = ['SAR', 'USD', 'EUR', 'GBP', 'AED', 'KWD', 'ريال', 'ر.س', '$', '€', '£'];

export function profileField(
  fieldName: string,
  values: unknown[],
  maxSampleSize: number = 1000
): FieldProfile {
  const totalCount = values.length;
  const sampleBased = totalCount > maxSampleSize;
  // Deterministic sampling: always first maxSampleSize
  const sample = sampleBased ? values.slice(0, maxSampleSize) : values;
  const sampleSize = sample.length;

  let nullCount = 0;
  const uniqueSet = new Set<string>();
  const sampleValues: unknown[] = [];

  let numericCount = 0;
  let integerCount = 0;
  let decimalCount = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let zeroCount = 0;

  let minNumeric: number | undefined;
  let maxNumeric: number | undefined;
  let sumNumeric = 0;
  let decimalPrecisionMax = 0;

  let stringCount = 0;
  let minStringLength: number | undefined;
  let maxStringLength: number | undefined;

  let dateMatchCount = 0;
  let dateTimeMatchCount = 0;
  let docIdMatchCount = 0;
  let currencyMatchCount = 0;
  let percentMatchCount = 0;
  let booleanCount = 0;

  for (let i = 0; i < sampleSize; i++) {
    const v = sample[i];
    if (v === null || v === undefined || v === '') {
      nullCount++;
      continue;
    }

    if (sampleValues.length < 5) {
      sampleValues.push(v);
    }

    const strVal = String(v).trim();
    uniqueSet.add(strVal);

    if (typeof v === 'boolean' || strVal.toLowerCase() === 'true' || strVal.toLowerCase() === 'false') {
      booleanCount++;
    }

    // Number check
    let numVal: number | null = null;
    if (typeof v === 'number' && !isNaN(v) && isFinite(v)) {
      numVal = v;
    } else if (typeof v === 'string') {
      // Check if it's a numeric string (without commas or currency)
      const cleanNum = strVal.replace(/,/g, '');
      if (/^-?\d+(\.\d+)?$/.test(cleanNum)) {
        numVal = Number(cleanNum);
      }
    }

    if (numVal !== null) {
      numericCount++;
      sumNumeric += numVal;
      if (minNumeric === undefined || numVal < minNumeric) minNumeric = numVal;
      if (maxNumeric === undefined || numVal > maxNumeric) maxNumeric = numVal;

      if (numVal > 0) positiveCount++;
      else if (numVal < 0) negativeCount++;
      else zeroCount++;

      if (Number.isInteger(numVal)) {
        integerCount++;
      } else {
        decimalCount++;
        const parts = String(numVal).split('.');
        if (parts[1] && parts[1].length > decimalPrecisionMax) {
          decimalPrecisionMax = parts[1].length;
        }
      }
    }

    // String check
    if (typeof v === 'string') {
      stringCount++;
      const len = strVal.length;
      if (minStringLength === undefined || len < minStringLength) minStringLength = len;
      if (maxStringLength === undefined || len > maxStringLength) maxStringLength = len;

      // Currency check
      for (const cur of CURRENCY_SYMBOLS) {
        if (strVal.includes(cur)) {
          currencyMatchCount++;
          break;
        }
      }

      // Percentage check
      if (strVal.endsWith('%')) {
        percentMatchCount++;
      }

      // Date & DateTime check
      let isDt = false;
      for (const r of DATETIME_REGEXES) {
        if (r.test(strVal)) {
          dateTimeMatchCount++;
          isDt = true;
          break;
        }
      }
      if (!isDt) {
        for (const r of DATE_REGEXES) {
          if (r.test(strVal)) {
            dateMatchCount++;
            break;
          }
        }
      }

      // Doc ID regex
      for (const r of DOC_ID_REGEXES) {
        if (r.test(strVal)) {
          docIdMatchCount++;
          break;
        }
      }
    } else if (v instanceof Date) {
      dateTimeMatchCount++;
    }
  }

  const validSampleCount = sampleSize - nullCount;
  const nullRate = sampleSize > 0 ? nullCount / sampleSize : 1;
  const uniqueRatio = validSampleCount > 0 ? uniqueSet.size / validSampleCount : 0;

  const isNumeric = validSampleCount > 0 && numericCount / validSampleCount >= 0.8;
  const isDateTime = validSampleCount > 0 && dateTimeMatchCount / validSampleCount >= 0.7;
  const isDate = !isDateTime && validSampleCount > 0 && (dateMatchCount + dateTimeMatchCount) / validSampleCount >= 0.7;
  const isBoolean = validSampleCount > 0 && booleanCount / validSampleCount >= 0.9;
  const isString = !isNumeric && !isDate && !isDateTime && !isBoolean;

  let primitiveType: PrimitiveType = 'string';
  if (isNumeric) primitiveType = 'number';
  else if (isDateTime || isDate) primitiveType = 'date';
  else if (isBoolean) primitiveType = 'boolean';
  else if (nullCount === sampleSize) primitiveType = 'null';

  const hasIdentifierPattern =
    uniqueRatio >= 0.8 &&
    validSampleCount >= 2 &&
    (docIdMatchCount > 0 || (isNumeric && integerCount === validSampleCount) || isString);

  const hasQuantityPattern =
    isNumeric &&
    integerCount === numericCount &&
    positiveCount === numericCount &&
    (maxNumeric !== undefined && maxNumeric < 100000);

  return {
    fieldName,
    primitiveType,
    isNumeric,
    isInteger: isNumeric && integerCount === numericCount,
    isDecimal: isNumeric && decimalCount > 0,
    isDate,
    isDateTime,
    isBoolean,
    isString,
    totalCount,
    sampleSize,
    nullCount,
    nullRate,
    uniqueCount: uniqueSet.size,
    uniqueRatio,
    minNumeric,
    maxNumeric,
    avgNumeric: numericCount > 0 ? sumNumeric / numericCount : undefined,
    positiveCount,
    negativeCount,
    zeroCount,
    decimalPrecisionMax,
    minStringLength,
    maxStringLength,
    hasIdentifierPattern,
    hasDatePattern: isDate || isDateTime || (validSampleCount > 0 && (dateMatchCount + dateTimeMatchCount) / validSampleCount >= 0.5),
    hasCurrencyPattern: currencyMatchCount > 0,
    hasPercentagePattern: percentMatchCount > 0,
    hasQuantityPattern,
    hasDocumentPattern: validSampleCount > 0 && docIdMatchCount / validSampleCount >= 0.5,
    sampleValues,
    sampleBased,
  };
}
