// @flow

import {put, call} from 'redux-saga/effects';
import {
  Device,
  Service,
  Characteristic,
  Descriptor,
  BleError,
  BleErrorCode,
} from 'react-native-ble-plx';
import {log, logError} from './Reducer';

export type SensorTagTestMetadata = {
  id: string,
  title: string,
  execute: (device: Device) => Generator<any, boolean, any>,
};

export const SensorTagTests: {[string]: SensorTagTestMetadata} = {
  READ_ALL_CHARACTERISTICS: {
    id: 'READ_ALL_CHARACTERISTICS',
    title: 'Read all characteristics',
    execute: readAllCharacteristics,
  },
  READ_TEMPERATURE: {
    id: 'READ_TEMPERATURE',
    title: 'Read temperature',
    execute: readTemperature,
  },
  TEST_COMMAND: {
    id: 'TEST_COMMAND',
    title: 'Test write',
    execute: testCommand,
  },
};

function* readAllCharacteristics(device: Device): Generator<*, boolean, *> {
  try {
    const services: Array<Service> = yield call([device, device.services]);
    // const services = yield call([
    //   device,
    //   device.discoverAllServicesAndCharacteristics,
    // ]);
    console.log('services: ', services);
    for (const service of services) {
      yield put(log('Found service: ' + service.uuid));
      const characteristics: Array<Characteristic> = yield call([
        service,
        service.characteristics,
      ]);
      for (const characteristic of characteristics) {
        yield put(log('Found characteristic: ' + characteristic.uuid));
        console.log('characteristic123: ', characteristic);
        if (characteristic.uuid === '00002a02-0000-1000-8000-00805f9b34fb')
          continue;

        const descriptors: Array<Descriptor> = yield call([
          characteristic,
          characteristic.descriptors,
        ]);

        console.log('descriptors123: ', descriptors);
        for (const descriptor of descriptors) {
          console.log('descriptor123: ', descriptor);
          yield put(log('* Found descriptor: ' + descriptor.uuid));
          const d: Descriptor = yield call([descriptor, descriptor.read]);
          console.log('d123: ', d);
          yield put(log('Descriptor value: ' + (d.value || 'null')));
          if (d.uuid === '00002902-0000-1000-8000-00805f9b34fb') {
            yield put(log('Skipping CCC'));
            continue;
          }
          try {
            yield call([descriptor, descriptor.write], 'AAA=');
          } catch (error) {
            const bleError: BleError = error;
            if (bleError.errorCode === BleErrorCode.DescriptorWriteFailed) {
              yield put(log('Cannot write to: ' + d.uuid));
            } else {
              throw error;
            }
          }
        }

        yield put(log('Found characteristic: ' + characteristic.uuid));

        if (characteristic.isReadable) {
          console.log('isReadable');
          yield put(log('Reading value...'));
          var c = yield call([characteristic, characteristic.read]);
          console.log('c: ', c);
          yield put(log('Got base64 value: ' + c.value));
          if (characteristic.isWritableWithResponse) {
            console.log('WRITEBLE');
            const writedSUCCESS = yield call(
              [characteristic, characteristic.writeWithResponse],
              c.value,
            );
            console.log('writedSUCCESS: ', writedSUCCESS);
            yield put(log('Successfully written value back'));
          }
        }
      }
    }
  } catch (error) {
    yield put(logError(error));
    return false;
  }

  return true;
}

function* readTemperature(device: Device): Generator<*, boolean, *> {
  yield put(log('Read temperature'));
  return false;
}

function* testCommand(device: Device): Generator<*, boolean, *> {
  const isCONN = yield call([device, 'isConnected']);
  console.log('isCONN123: ', isCONN);
  console.log('deviceCURRENT: ', device);
  yield put(log('Send 0002'));

  const devCS = yield call([device, 'discoverAllServicesAndCharacteristics']);
  console.log('devCS: ', devCS);
  try {
    // const services: Array<Service> = yield call([
    //   device,
    //   device.discoverAllServicesAndCharacteristics,
    // ]);
    // console.log('servicesDISCOVER: ', services);
    // const uuids = yield call([device, 'serviceUUIDs']);
    // console.log('uuids: ', uuids);
    const response = yield call(
      [device, 'writeCharacteristicWithoutResponseForService'],
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // SERVICE UUID
      '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // UUID
      'AAI=', // VALUE in base64 (in hex is 0002)
    );
    console.log('response: ', response);
  } catch (error) {
    console.log('error: ', error);
    yield put(logError(error));
    return false;
  }

  return true;
}

// DEVICE ID = C2:A2:02:56:AA:90
// SERVICE UUID = 00001800-0000-1000-8000-00805f9b34fb
// UUID = 00002a00-0000-1000-8000-00805f9b34fb
