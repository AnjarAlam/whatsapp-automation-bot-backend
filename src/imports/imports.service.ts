import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { CustomersService } from '../customers/customers.service';

export interface ImportErrorRow {
  row: number;
  data: any;
  error: string;
}

export interface ImportSummary {
  importedCount: number;
  failedCount: number;
  errorRows: ImportErrorRow[];
}

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(private readonly customersService: CustomersService) {}

  async processCustomerImport(
    userId: string | Types.ObjectId,
    file: Express.Multer.File,
  ): Promise<ImportSummary> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided for import');
    }

    let rows: any[] = [];
    const filename = file.originalname.toLowerCase();

    if (filename.endsWith('.csv') || file.mimetype.includes('csv')) {
      const csvString = file.buffer.toString('utf-8');
      const parsed = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
      });
      rows = parsed.data;
    } else if (
      filename.endsWith('.xlsx') ||
      filename.endsWith('.xls') ||
      file.mimetype.includes('spreadsheet') ||
      file.mimetype.includes('excel')
    ) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      rows = jsonRows.map((r: any) => {
        const normalized: any = {};
        for (const key of Object.keys(r)) {
          normalized[key.trim().toLowerCase()] = r[key];
        }
        return normalized;
      });
    } else {
      throw new BadRequestException('Unsupported file format. Please upload CSV or Excel (.xlsx).');
    }

    let importedCount = 0;
    let failedCount = 0;
    const errorRows: ImportErrorRow[] = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 1;

      // Extract fields dynamically (supporting 'name', 'mobile'/'phone', 'email')
      const name = row['name'] || row['customer name'] || row['fullName'] || '';
      const mobile =
        row['mobile'] ||
        row['mobile number'] ||
        row['phone'] ||
        row['phone number'] ||
        '';
      const email = row['email'] || row['email address'] || '';

      if (!name || !mobile) {
        failedCount++;
        errorRows.push({
          row: rowNumber,
          data: row,
          error: 'Name and Mobile fields are required.',
        });
        continue;
      }

      // Format mobile number
      const cleanMobile = String(mobile).replace(/[^\d+]/g, '');
      if (cleanMobile.length < 7) {
        failedCount++;
        errorRows.push({
          row: rowNumber,
          data: row,
          error: 'Invalid mobile number format.',
        });
        continue;
      }

      try {
        await this.customersService.create(userId, {
          name: String(name).trim(),
          mobile: cleanMobile,
          email: email ? String(email).trim() : undefined,
          tags: ['Bulk Import'],
        });
        importedCount++;
      } catch (err: any) {
        failedCount++;
        errorRows.push({
          row: rowNumber,
          data: row,
          error: err.message || 'Duplicate or invalid customer record.',
        });
      }
    }

    return {
      importedCount,
      failedCount,
      errorRows,
    };
  }
}
