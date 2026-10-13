import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { parseEnv } from '../config/env';
import { dataSourceOptions } from './dataSourceOptions';

export const dataSource = new DataSource(dataSourceOptions(parseEnv(process.env)));
