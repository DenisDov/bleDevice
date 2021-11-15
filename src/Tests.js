// @flow

import {put, call, take, fork, spawn} from 'redux-saga/effects';
import {buffers, eventChannel} from 'redux-saga';
import {
  Device,
  Service,
  Characteristic,
  Descriptor,
  BleError,
  BleErrorCode,
} from 'react-native-ble-plx';
import {log, logError} from './Reducer';

import {base64ToHex} from './utils';

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
  // READ_TEMPERATURE: {
  //   id: 'READ_TEMPERATURE',
  //   title: 'Read temperature',
  //   execute: readTemperature,
  // },
  TEST_COMMAND: {
    id: 'TEST_COMMAND',
    title: 'Test write 0002',
    execute: testCommand,
  },
};

function notificationListener(device, SERVICE_UUID, CHAR_UUID) {
  return eventChannel(emit => {
    const subscription = device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHAR_UUID,
      (error, characteristic) => {
        emit([error, characteristic]);
      },
    );
    return () => {
      subscription.remove();
    };
  }, buffers.expanding(1));
}

function* notificationSaga(device, SERVICE_UUID, CHAR_UUID) {
  const channel = yield call(
    notificationListener,
    device,
    SERVICE_UUID,
    CHAR_UUID,
  );
  try {
    while (true) {
      // take(END) will cause the saga to terminate by jumping to the finally block
      const [error, characteristic] = yield take(channel);
      console.log('error, characteristic: ', error, characteristic);
      yield put(log(`Get value ${base64ToHex(characteristic.value)}`));
    }
  } finally {
    console.log('saga terminated');
  }
}

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

function* testCommand(device) {
  // const isCONN = yield call([device, 'isConnected']);
  // console.log('isCONN123: ', isCONN);
  // console.log('deviceCURRENT: ', device);
  yield put(log('Send value 0002'));

  // const devCS = yield call([device, 'discoverAllServicesAndCharacteristics']);
  // console.log('devCS: ', devCS);

  try {
    yield spawn(
      notificationSaga,
      device,
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
      '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
    );

    yield call(
      [device, 'writeCharacteristicWithoutResponseForService'],
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // SERVICE UUID
      '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // RX CHARACTERISTIC UUID
      'AAI=', // VALUE in base64 (in hex is 0002)
    );
  } catch (error) {
    console.log('error: ', error);
    yield put(logError(error));
    return false;
  }

  return true;
}

// DEVICE ID = C2:A2:02:56:AA:90
// SERVICE UUID = 6e400001-b5a3-f393-e0a9-e50e24dcca9e
// RX CHARACTERISTIC UUID = 6e400002-b5a3-f393-e0a9-e50e24dcca9e
// TX CHARACTERISTIC UUID = 6e400002-b5a3-f393-e0a9-e50e24dcca9e
