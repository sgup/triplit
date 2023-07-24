import { InMemoryTupleStorage } from 'tuple-database';
import { describe, expect, it, beforeEach, beforeAll, vi } from 'vitest';
import {
  and,
  CollectionQuery,
  Migration,
  DB,
  or,
  Schema as S,
  CollectionQueryBuilder,
} from '../src';
import { classes, students, departments } from './sample_data/school';
import { timestampedObjectToPlainObject } from '../src/schema';
import MemoryBTree from '../src/storage/memory-btree';
import exp from 'constants';
import { stripCollectionFromId } from '../src/db';

// const storage = new InMemoryTupleStorage();
const storage = new MemoryBTree();

describe('Database API', () => {
  let db: DB<any>;
  beforeEach(async () => {
    db = new DB({});
    for (const student of students) {
      await db.insert('Student', student, student.id);
    }
    for (const schoolClass of classes) {
      await db.insert('Class', schoolClass, schoolClass.id);
    }
    for (const department of departments) {
      await db.insert('Department', department, department.id);
    }
    for (const rapper of RAPPERS_AND_PRODUCERS) {
      await db.insert('Rapper', rapper, rapper.id);
    }
  });
  it('can furnish the client id', async () => {
    expect(await db.getClientId()).toBeTruthy();
  });

  it('will throw an error if the provided entity id has a # sign in it', async () => {
    expect(
      async () => await db.insert('Student', { name: 'John Doe' }, 'John#Doe')
    ).rejects.toThrowError();
    expect(
      db.transact((tx) =>
        tx.insert('Student', { name: 'John Doe' }, 'John#Doe')
      )
    ).rejects.toThrowError();
  });

  it('will throw an error when it parses an ID with a # in it', async () => {
    expect(() => stripCollectionFromId('Student#john#1')).toThrowError();
  });

  it('can lookup entity by Id', async () => {
    const student1 = await db.fetchById('Student', students[0].id);
    expect(student1).not.toBeNull();

    const notAStudent = await db.fetchById('Student', `not_a_real_id`);
    expect(notAStudent).toBeNull();
  });

  it('supports basic queries with filters', async () => {
    const eq = await db.fetch(
      CollectionQueryBuilder('Class')
        .where([['level', '=', 100]])
        .build()
    );
    expect(eq.size).toBe(classes.filter((cls) => cls.level === 100).length);
    const neq = await db.fetch(
      CollectionQueryBuilder('Class')
        .where([['level', '!=', 100]])
        .build()
    );
    expect(neq.size).toBe(classes.filter((cls) => cls.level !== 100).length);
    const gt = await db.fetch(
      CollectionQueryBuilder('Class')
        .where([['level', '>', 100]])
        .build()
    );
    expect(gt.size).toBe(classes.filter((cls) => cls.level > 100).length);
    const gte = await db.fetch(
      CollectionQueryBuilder('Class')
        .where([['level', '>=', 100]])
        .build()
    );
    expect(gte.size).toBe(classes.filter((cls) => cls.level >= 100).length);
    const lt = await db.fetch(
      CollectionQueryBuilder('Class')
        .where([['level', '<', 200]])
        .build()
    );
    expect(lt.size).toBe(classes.filter((cls) => cls.level < 200).length);
    const lte = await db.fetch(
      CollectionQueryBuilder('Class')
        .where([['level', '<=', 200]])
        .build()
    );
    expect(lte.size).toBe(classes.filter((cls) => cls.level <= 200).length);
  });

  it('supports basic queries with the "like" operator', async () => {
    const studentsNamedJohn = await db.fetch(
      CollectionQueryBuilder('Student')
        .where([['name', 'like', 'John%']])
        .build()
    );
    expect(studentsNamedJohn.size).toBe(
      students.filter((s) => s.name.startsWith('John')).length
    );

    const studentswithIeIntheirName = await db.fetch(
      CollectionQueryBuilder('Student')
        .where([['name', 'like', '%ie%']])
        .build()
    );
    expect(studentswithIeIntheirName.size).toBe(
      students.filter((s) => s.name.includes('ie')).length
    );

    const calculusClasses = await db.fetch(
      CollectionQueryBuilder('Class')
        .where([['name', 'like', 'Calculus _']])
        .build()
    );
    expect(calculusClasses.size).toBe(
      classes.filter((c) => new RegExp('Calculus *').test(c.name)).length
    );

    const escapeOutRegex = await db.fetch(
      CollectionQueryBuilder('Class')
        .where([['name', 'like', 'Calculus*+']])
        .build()
    );
    expect(escapeOutRegex.size).not.toBe(
      classes.filter((c) => new RegExp('Calculus *').test(c.name)).length
    );
    const departmentsWithSinTheMiddleOfTheirName = await db.fetch(
      CollectionQueryBuilder('Department')
        .where([['name', 'like', '%_s_%']])
        .build()
    );
    expect(departmentsWithSinTheMiddleOfTheirName.size).toBe(2);
    const artistsWithDashInTheirName = await db.fetch(
      CollectionQueryBuilder('Rapper')
        .where([['name', 'like', '%-%']])
        .build()
    );
    expect(artistsWithDashInTheirName.size).toBe(2);
    const artistsWithDollaSignInTheirName = await db.fetch(
      CollectionQueryBuilder('Rapper')
        .where([['name', 'like', '%$%']])
        .build()
    );
    expect(artistsWithDollaSignInTheirName.size).toBe(1);

    const artistsWithQuotesInTheirName = await db.fetch(
      CollectionQueryBuilder('Rapper')
        .where([['name', 'like', "%'%'%"]])
        .build()
    );
    expect(artistsWithQuotesInTheirName.size).toBe(2);

    const Biggie = await db.fetch(
      CollectionQueryBuilder('Rapper')
        .where([['name', 'like', '%B.I.G%.']])
        .build()
    );
    expect(Biggie.size).toBe(1);
  });

  const RAPPERS_AND_PRODUCERS = [
    { name: 'Ty Dolla $ign', id: 1 },
    { name: 'Boi-1da', id: 2 },
    { name: 'Mike Will Made-It', id: 3 },
    { name: "Noah '40' Shebib", id: 4 },
    { name: 'The Notoious B.I.G.', id: 5 },
    { name: "Travis 'LaFlame' Scott", id: 6 },
  ];

  it('supports basic queries without filters', async () => {
    const results = await db.fetch(CollectionQueryBuilder('Student').build());
    expect(results.size).toBe(students.length);
  });

  it('throws an error when filtering with an unimplmented operator', async () => {
    await expect(
      db.fetch(
        CollectionQueryBuilder('Rapper')
          .where([['name', 'not a real operator', 'Boi-1da']])
          .build()
      )
    ).rejects.toThrowError();
  });

  it('supports filtering on one attribute with multiple operators', async () => {
    const results = await db.fetch(
      CollectionQueryBuilder('Rapper')
        .where([
          and([
            ['id', '<', 5],
            ['id', '>=', 2],
          ]),
        ])
        .build()
    );
    const ids = [...results.values()].map((r) => r.id[0]);
    expect(Math.max(...ids)).toBe(4);
    expect(Math.min(...ids)).toBe(2);
    expect(results.size).toBe(3);
  });

  it('throws an error when a non-terminal object path is provided', async () => {
    await db.insert('Rapper', {
      id: 7,
      name: 'Jay-Z',
      album: { name: 'The Blueprint', released: '2001' },
    });
    await expect(
      db.fetch(
        CollectionQueryBuilder('Rapper')
          .where([['album', '=', 'The Blueprint']])
          .build()
      )
    ).rejects.toThrowError();
    await expect(
      db.fetch(
        CollectionQueryBuilder('Rapper')
          .where([['album.name', '=', 'The Blueprint']])
          .build()
      )
    ).resolves.not.toThrowError();
  });

  it.todo('supports compound queries', async () => {
    const twoHundredLevelClasses = db
      .collection('Class')
      .query()
      .where([['level', '=', 200]])
      .fetch();
    const twoHundredMathClasses = twoHundredLevelClasses
      .query({
        where: [['department>Department.name', '=', 'math']],
      })
      .fetch();
    expect(twoHundredLevelClasses.query()).toHaveLength(2);
    expect(twoHundredMathClasses).toHaveLength(1);
  });

  it('supports basic select statements', async () => {
    const results = await db.fetch(
      CollectionQueryBuilder('Class').select(['name', 'level']).build()
    );
    [...results.values()].forEach((entityObj) => {
      expect(entityObj).toHaveProperty('name');
      expect(entityObj).toHaveProperty('level');
      expect(entityObj).not.toHaveProperty('department');
      expect(entityObj).not.toHaveProperty('enrolled_students');
    });
  });

  it('can report basic collection stats from the database', async () => {
    const stats = await db.getCollectionStats();
    expect([...stats.keys()]).toEqual([
      'Class',
      'Department',
      'Rapper',
      'Student',
    ]);
    expect(stats.get('Student')).toBe(students.length);
    expect(stats.get('Class')).toBe(classes.length);
    expect(stats.get('Department')).toBe(departments.length);
  });
});

describe('OR queries', () => {
  const db = new DB({ source: new InMemoryTupleStorage() });
  it('supports OR queries', async () => {
    // storage.data = [];
    await db.insert(
      'roster',
      { id: 1, name: 'Alice', age: 22, team: 'red' },
      1
    );
    await db.insert('roster', { id: 2, name: 'Bob', age: 23, team: 'blue' }, 2);
    await db.insert(
      'roster',
      { id: 3, name: 'Charlie', age: 22, team: 'blue' },
      3
    );
    await db.insert(
      'roster',
      { id: 4, name: 'Dennis', age: 24, team: 'blue' },
      4
    );
    await db.insert('roster', { id: 5, name: 'Ella', age: 23, team: 'red' }, 5);
    const redOr22 = await db.fetch(
      CollectionQueryBuilder('roster')
        .where([
          or([
            ['team', '=', 'red'],
            ['age', '=', 22],
          ]),
        ])
        .build()
    );
    expect(redOr22).toHaveLength(3);
    expect([...redOr22.keys()]).toEqual(
      expect.arrayContaining(
        ['1', '3', '5'].map((id) => expect.stringContaining(id.toString()))
      )
    );

    const blue23Or22 = await db.fetch(
      CollectionQueryBuilder('roster')
        .where([
          or([
            and([
              ['team', '=', 'blue'],
              ['age', '=', 23],
            ]),
            ['age', '=', 22],
          ]),
        ])
        .build()
    );
    expect(blue23Or22).toHaveLength(3);
    expect([...blue23Or22.keys()]).toEqual(
      expect.arrayContaining(
        [1, 2, 3].map((id) => expect.stringContaining(id.toString()))
      )
    );
  });
});

describe('Register operations', () => {
  let db;
  beforeEach(async () => {
    db = new DB({ source: new InMemoryTupleStorage() });
    await db.insert('employees', { id: 1, name: 'Philip J. Fry' }, 1);
    await db.insert('employees', { id: 2, name: 'Turanga Leela' }, 2);
    await db.insert('employees', { id: 3, name: 'Amy Wong' }, 3);
    await db.insert(
      'employees',
      { id: 4, name: 'Bender Bending Rodriguez' },
      4
    );
    await db.insert('employees', { id: 5, name: 'Hermes Conrad' }, 5);
  });

  it('can set register', async () => {
    const preUpdateQuery = CollectionQueryBuilder('employees')
      .select(['id'])
      .where([['name', '=', 'Philip J. Fry']])
      .build();

    const preUpdateLookup = await db.fetch(preUpdateQuery);
    expect(preUpdateLookup).toHaveLength(1);
    expect(preUpdateLookup.get('1')).toBeTruthy();

    const NEW_NAME = 'Dr. Zoidberg';

    await db.update('employees', 1, async (entity) => {
      await entity.attribute(['name']).set(NEW_NAME);
    });

    const postUpdateQuery = CollectionQueryBuilder('employees')
      .select(['id', 'name'])
      .where([['name', '=', NEW_NAME]])
      .build();

    const oldQueryResult = await db.fetch(preUpdateQuery);
    const newQueryResult = await db.fetch(postUpdateQuery);
    expect(oldQueryResult).toHaveLength(0);
    expect(newQueryResult).toHaveLength(1);
    expect(newQueryResult.get('1')).toBeTruthy();
    expect(timestampedObjectToPlainObject(newQueryResult.get('1')).name).toBe(
      NEW_NAME
    );
  });
});

describe('Set operations', () => {
  const schema = {
    companies: S.Schema({
      id: S.number(),
      name: S.string(),
      employees: S.Set(S.number()),
    }),
  };
  let db: DB<typeof schema>;
  beforeEach(async () => {
    storage.data = [];
    db = new DB({ source: new InMemoryTupleStorage(), schema });
    await db.insert(
      'companies',
      { id: 1, name: 'Planet Express', employees: new Set([1, 2, 3]) },
      1
    );
    await db.insert(
      'companies',
      { id: 2, name: 'MomCorp', employees: new Set([4, 5, 6]) },
      2
    );
  });

  it('can add to set', async () => {
    const setQuery = CollectionQueryBuilder('companies', schema.companies)
      .select(['id'])
      .where([['employees', '=', 7]])
      .build();

    const preUpdateLookup = await db.fetch(setQuery);
    expect(preUpdateLookup).toHaveLength(0);

    await db.update('companies', 1, async (entity) => {
      await entity.attribute(['employees']).add(7);
    });
    const postUpdateLookup = await db.fetch(setQuery);

    expect(postUpdateLookup).toHaveLength(1);
    expect(postUpdateLookup.get('1')).toBeTruthy();
  });

  it('can remove from set', async () => {
    const setQuery = CollectionQueryBuilder('companies', schema.companies)
      .select(['id'])
      .where([['employees', '=', 2]])
      .build();

    const preUpdateLookup = await db.fetch(setQuery);
    expect(preUpdateLookup).toHaveLength(1);
    expect(preUpdateLookup.get('1')).toBeTruthy();

    await db.update('companies', 1, async (entity) => {
      await entity.attribute(['employees']).remove(2);
    });

    const postUpdateLookup = await db.fetch(setQuery);

    expect(postUpdateLookup).toHaveLength(0);
  });
});

describe.todo('array operations');

describe('subscriptions', () => {
  let db: DB<any>;
  beforeEach(async () => {
    db = new DB({ source: new InMemoryTupleStorage() });
    const docs = [
      { id: 1, name: 'Alice', major: 'Computer Science', dorm: 'Allen' },
      { id: 2, name: 'Bob', major: 'Biology', dorm: 'Battell' },
      { id: 3, name: 'Charlie', major: 'Computer Science', dorm: 'Battell' },
      { id: 4, name: 'David', major: 'Math', dorm: 'Allen' },
      { id: 5, name: 'Emily', major: 'Biology', dorm: 'Allen' },
    ];
    await Promise.all(docs.map((doc) => db.insert('students', doc, doc.id)));
  });

  it('handles selection updates', async (done) => {
    return new Promise<void>(async (resolve, reject) => {
      let i = 0;
      const assertions = [
        (data) => expect(data.get('1').major[0]).toBe('Computer Science'),
        (data) => {
          try {
            expect(data.get('1').major[0]).toBe('Math');
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      ];

      const unsubscribe = db.subscribe(
        CollectionQueryBuilder('students')
          .select(['major'])
          .where([['name', '=', 'Alice']])
          .build(),
        async (students) => {
          assertions[i](students);
          i++;
        }
      );
      setTimeout(async () => {
        await db.update('students', 1, async (entity) => {
          await entity.attribute(['major']).set('Math');
        });
        await unsubscribe();
      }, 20);
    });
  });

  it('handles data entering query', async () => {
    let i = 0;
    const assertions = [
      (data) => expect(data.size).toBe(2),
      (data) => expect(data.size).toBe(3),
    ];
    const unsubscribe = db.subscribe(
      CollectionQueryBuilder('students')
        .select(['name', 'major'])
        .where([['dorm', '=', 'Battell']])
        .build(),
      (students) => {
        assertions[i](students);
        i++;
      }
    );

    await db.update('students', '1', async (entity) => {
      await entity.attribute(['dorm']).set('Battell');
    });

    await unsubscribe();
  });

  it('handles data leaving query', async () => {
    return new Promise<void>(async (resolve, reject) => {
      let i = 0;
      const assertions = [
        (data) => expect(data.size).toBe(3),
        (data) => {
          try {
            expect(data.size).toBe(2);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      ];

      const unsubscribe = db.subscribe(
        CollectionQueryBuilder('students')
          .select(['name', 'dorm', 'grade'])
          .where([['dorm', '=', 'Allen']])
          .build(),
        (students) => {
          assertions[i](students);
          i++;
        }
      );

      await db.update('students', '1', async (entity) => {
        await entity.attribute(['dorm']).set('Battell');
      });

      await unsubscribe();
    });
  });

  it('handles order and limit', async () => {
    return new Promise<void>(async (resolve, reject) => {
      let i = 0;
      let LIMIT = 2;
      const assertions = [
        (data) => {
          expect(data.size).toBe(LIMIT);
          expect([...data.values()].map((r) => r.major[0])).toEqual([
            'Biology',
            'Biology',
          ]);
        },
        (data) => {
          try {
            expect(data.size).toBe(LIMIT);
            expect([...data.values()].map((r) => r.major[0])).toEqual([
              'Astronomy',
              'Biology',
            ]);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      ];

      const unsubscribe = db.subscribe(
        CollectionQueryBuilder('students')
          .limit(2)
          .order(['major', 'ASC'])
          .build(),
        (students) => {
          assertions[i](students);
          i++;
        }
      );

      await db.insert(
        'students',
        { id: 6, name: 'Frank', major: 'Astronomy', dorm: 'Allen' },
        '6'
      );

      await unsubscribe();
    });
  });

  it('can subscribe to just triples', async () => {
    return new Promise<void>(async (resolve, reject) => {
      let i = 0;
      let LIMIT = 2;
      const assertions = [
        (data) => {
          expect(data).toHaveLength(LIMIT * 5);
        },
        (data) => {
          try {
            expect(data).toHaveLength(5);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      ];

      const unsubscribe = db.subscribeTriples(
        CollectionQueryBuilder('students')
          .limit(2)
          .order(['major', 'ASC'])
          .build(),
        (students) => {
          assertions[i](students);
          i++;
        }
      );

      await db.insert(
        'students',
        { id: 6, name: 'Frank', major: 'Astronomy', dorm: 'Allen' },
        '6'
      );

      await unsubscribe();
    });
  });
});

const testScores = [
  {
    score: 80,
    date: '2023-04-16',
  },
  {
    score: 76,
    date: '2023-03-06',
  },
  {
    score: 95,
    date: '2023-04-20',
  },
  {
    score: 87,
    date: '2023-04-21',
  },
  {
    score: 75,
    date: '2023-04-09',
  },
  {
    score: 70,
    date: '2023-05-28',
  },
  {
    score: 80,
    date: '2023-03-16',
  },
  {
    score: 78,
    date: '2023-05-01',
  },
  {
    score: 70,
    date: '2023-04-23',
  },
  {
    score: 76,
    date: '2023-04-06',
  },
  {
    score: 99,
    date: '2023-03-24',
  },
  {
    score: 73,
    date: '2023-03-13',
  },
  {
    score: 87,
    date: '2023-04-12',
  },
  {
    score: 99,
    date: '2023-03-17',
  },
  {
    score: 87,
    date: '2023-04-24',
  },
  {
    score: 96,
    date: '2023-03-26',
  },
  {
    score: 91,
    date: '2023-05-07',
  },
  {
    score: 75,
    date: '2023-04-17',
  },
  {
    score: 98,
    date: '2023-05-28',
  },
  {
    score: 96,
    date: '2023-05-24',
  },
];
describe('ORDER & LIMIT & Pagination', () => {
  const db = new DB({
    source: storage,
    schema: {
      TestScores: S.Schema({
        score: S.number(),
        date: S.string(),
      }),
    },
  });
  beforeAll(async () => {
    for (const result of testScores) {
      await db.insert('TestScores', result);
    }
  });

  it('order by DESC', async () => {
    const descendingScoresResults = await db.fetch(
      CollectionQueryBuilder('TestScores').order(['score', 'DESC']).build()
    );
    expect(descendingScoresResults.size).toBe(testScores.length);
    const areAllScoresDescending = Array.from(
      descendingScoresResults.values()
    ).every((result, i, arr) => {
      if (i === 0) return true;
      const previousScore = arr[i - 1].score[0];
      const currentScore = result.score[0];
      return previousScore >= currentScore;
    });
    expect(areAllScoresDescending).toBeTruthy();
  });

  it('order by ASC', async () => {
    const descendingScoresResults = await db.fetch(
      CollectionQueryBuilder('TestScores').order(['score', 'ASC']).build()
    );
    expect(descendingScoresResults.size).toBe(testScores.length);
    const areAllScoresDescending = Array.from(
      descendingScoresResults.values()
    ).every((result, i, arr) => {
      if (i === 0) return true;
      const previousScore = arr[i - 1].score[0];
      const currentScore = result.score[0];
      return previousScore <= currentScore;
    });
    expect(areAllScoresDescending).toBeTruthy();
  });

  it('limit', async () => {
    const descendingScoresResults = await db.fetch(
      CollectionQueryBuilder('TestScores')
        .order(['score', 'DESC'])
        .limit(5)
        .build()
    );
    expect(descendingScoresResults.size).toBe(5);
    const areAllScoresDescending = Array.from(
      descendingScoresResults.values()
    ).every((result, i, arr) => {
      if (i === 0) return true;
      const previousScore = arr[i - 1].score[0];
      const currentScore = result.score[0];
      return previousScore >= currentScore;
    });
    expect(areAllScoresDescending).toBeTruthy();
  });

  it('can paginate DESC', async () => {
    const firstPageResults = await db.fetch(
      CollectionQueryBuilder('TestScores')
        .order(['score', 'DESC'])
        .limit(5)
        .build()
    );
    expect(firstPageResults.size).toBe(5);
    const areAllScoresDescending = Array.from(firstPageResults.values()).every(
      (result, i, arr) => {
        if (i === 0) return true;
        const previousScore = arr[i - 1].score[0];
        const currentScore = result.score[0];
        return previousScore >= currentScore;
      }
    );
    expect(areAllScoresDescending).toBeTruthy();

    const lastDoc = [...firstPageResults.entries()][4];

    const secondPageResults = await db.fetch(
      CollectionQueryBuilder('TestScores')
        .order(['score', 'DESC'])
        .limit(5)
        .after([lastDoc[1].score[0], lastDoc[0]])
        .build()
    );

    console.log(
      [...firstPageResults.values(), ...secondPageResults.values()].map(
        (r) => r.score[0]
      )
    );

    const areAllScoresDescendingAfterSecondPage = [
      ...firstPageResults.values(),
      ...secondPageResults.values(),
    ].every((result, i, arr) => {
      if (i === 0) return true;
      const previousScore = arr[i - 1].score[0];
      const currentScore = result.score[0];
      return previousScore >= currentScore;
    });

    expect(secondPageResults.size).toBe(5);
    expect(areAllScoresDescendingAfterSecondPage).toBeTruthy();
  });

  it('can paginate ASC', async () => {
    const firstPageResults = await db.fetch(
      CollectionQueryBuilder('TestScores')
        .order(['score', 'ASC'])
        .limit(5)
        .build()
    );
    expect(firstPageResults.size).toBe(5);
    const areAllScoresAscending = Array.from(firstPageResults.values()).every(
      (result, i, arr) => {
        if (i === 0) return true;
        const previousScore = arr[i - 1].score[0];
        const currentScore = result.score[0];
        return previousScore <= currentScore;
      }
    );
    expect(areAllScoresAscending).toBeTruthy();

    const lastDoc = [...firstPageResults.entries()][4];

    const secondPageResults = await db.fetch(
      CollectionQueryBuilder('TestScores')
        .order(['score', 'ASC'])
        .limit(5)
        .after([lastDoc[1].score[0], lastDoc[0]])
        .build()
    );

    console.log(
      [...firstPageResults.values(), ...secondPageResults.values()].map(
        (r) => r.score[0]
      )
    );

    const areAllScoresAscendingAfterSecondPage = [
      ...firstPageResults.values(),
      ...secondPageResults.values(),
    ].every((result, i, arr) => {
      if (i === 0) return true;
      const previousScore = arr[i - 1].score[0];
      const currentScore = result.score[0];
      return previousScore <= currentScore;
    });

    expect(secondPageResults.size).toBe(5);
    expect(areAllScoresAscendingAfterSecondPage).toBeTruthy();
  });
});

describe('database transactions', () => {
  // beforeEach(() => {
  //   storage.data = [];
  // });
  it('can implicitly commit a transaction', async () => {
    const db = new DB({
      source: new InMemoryTupleStorage(),
      schema: {
        TestScores: S.Schema({
          score: S.number(),
          date: S.string(),
        }),
      },
    });
    await db.transact(async (tx) => {
      await tx.insert('TestScores', {
        score: 80,
        date: '2023-04-16',
      });
      expect(
        (await db.fetch(CollectionQueryBuilder('TestScores').build())).size
      ).toBe(0);
      expect(
        (await tx.fetch(CollectionQueryBuilder('TestScores').build())).size
      ).toBe(1);
    });
    expect(
      (await db.fetch(CollectionQueryBuilder('TestScores').build())).size
    ).toBe(1);
    // expect(() => tx.collection('TestScores').query().fetch()).toThrowError();
  });
  it('can rollback a transaction', async () => {
    const db = new DB({
      source: new InMemoryTupleStorage(),
      schema: {
        TestScores: S.Schema({
          score: S.number(),
          date: S.string(),
        }),
      },
    });
    await db.transact(async (tx) => {
      await tx.insert('TestScores', {
        score: 80,
        date: '2023-04-16',
      });
      expect(
        (await db.fetch(CollectionQueryBuilder('TestScores').build())).size
      ).toBe(0);
      expect(
        (await tx.fetch(CollectionQueryBuilder('TestScores').build())).size
      ).toBe(1);
      await tx.cancel();
    });
    expect(
      (await db.fetch(CollectionQueryBuilder('TestScores').build())).size
    ).toBe(0);
    // expect(() => tx.collection('TestScores').query().fetch()).toThrowError();
  });
  it("can't commit inside the transaction callback", async () => {
    const db = new DB({});
    expect(
      db.transact(async (tx) => {
        tx.commit();
      })
    ).rejects.toThrowError();
  });
  it('can fetch by id in a transaction', async () => {
    const db = new DB({});
    await db.transact(async (tx) => {
      await tx.insert(
        'TestScores',
        {
          score: 80,
          date: '2023-04-16',
        },
        '1'
      );
      const result = await tx.fetchById('TestScores', '1');
      expect(result.score[0]).toBe(80);
    });
    expect((await db.fetchById('TestScores', '1')).score[0]).toBe(80);
  });
  it('can update an entity in a transaction', async () => {
    const db = new DB({
      schema: {
        TestScores: S.Schema({
          score: S.number(),
          date: S.string(),
        }),
      },
    });
    await db.insert(
      'TestScores',
      {
        score: 80,
        date: '2023-04-16',
      },
      'score-1'
    );
    await db.transact(async (tx) => {
      expect((await db.fetchById('TestScores', 'score-1')).score[0]).toBe(80);
      await tx.update('TestScores', 'score-1', async (entity) => {
        await entity.attribute(['score']).set(100);
      });
      expect((await tx.fetchById('TestScores', 'score-1')).score[0]).toBe(100);
    });
    expect((await db.fetchById('TestScores', 'score-1')).score[0]).toBe(100);
  });
  it('awaits firing subscription until transaction is committed', async () => {
    const db = new DB({
      source: new InMemoryTupleStorage(),
      schema: {
        TestScores: S.Schema({
          score: S.number(),
          date: S.string(),
        }),
      },
    });
    const insertSpy = vi.fn();
    db.tripleStore.onInsert(insertSpy);
    await db.transact(async (tx) => {
      await tx.insert('TestScores', {
        score: 80,
        date: '2023-04-16',
      });
      await tx.insert('TestScores', {
        score: 90,
        date: '2023-04-17',
      });
      expect(insertSpy).not.toHaveBeenCalled();
    });
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });
});

describe('schema changes', async () => {
  it('can add a collection definition to the schema', async () => {
    // const schema = {};
    const db = new DB({ source: new InMemoryTupleStorage() });
    await db.createCollection({
      name: 'students',
      attributes: {
        id: { type: 'number' },
        name: { type: 'string' },
      },
    });
    const schema = await db.getSchema();
    expect(schema).toHaveProperty('students');
    expect(schema.students.properties).toHaveProperty('id');
    expect(schema.students.properties).toHaveProperty('name');
  });

  it('can drop a collection definition from the schema', async () => {
    const schema = {
      students: S.Schema({
        id: S.number(),
        name: S.string(),
      }),
    };
    const db = new DB({ source: new InMemoryTupleStorage(), schema: schema });
    const dbSchemaBefore = await db.getSchema();
    expect(dbSchemaBefore).toHaveProperty('students');
    await db.dropCollection({ name: 'students' });
    const dbSchemaAfter = await db.getSchema();
    expect(dbSchemaAfter).not.toHaveProperty('students');

    // TODO: test data is actually dropped if we decide it should be
  });

  it('can rename an attribute', async () => {
    const schema = {
      students: S.Schema({
        id: S.number(),
        name: S.string(),
      }),
    };
    const db = new DB({ source: new InMemoryTupleStorage(), schema: schema });
    await db.insert('students', { id: 1, name: 'Alice' }, 1);
    await db.renameAttribute({
      collection: 'students',
      path: 'id',
      newPath: 'studentId',
    });
    const dbSchema = await db.getSchema();
    expect(dbSchema).toHaveProperty('students');
    expect(dbSchema?.students.properties).toHaveProperty('studentId');
    expect(dbSchema?.students.properties).toHaveProperty('name');
    const query = db
      .query('students')
      .where([['studentId', '=', 1]])
      .build();
    const result = await db.fetch(query);
    expect(result).toHaveLength(1);
    expect(result.get('1').studentId[0]).toEqual(1);
  });

  it('can add an attribute', async () => {
    const schema = {
      students: S.Schema({
        id: S.number(),
        name: S.string(),
      }),
    };
    const db = new DB({ source: new InMemoryTupleStorage(), schema: schema });
    await db.insert('students', { id: 1, name: 'Alice' }, 1);
    await db.addAttribute({
      collection: 'students',
      path: 'age',
      attribute: { type: 'number' },
    });
    const dbSchema = await db.getSchema();
    expect(dbSchema).toHaveProperty('students');
    expect(dbSchema.students.properties).toHaveProperty('age');
    expect(dbSchema.students.properties).toHaveProperty('name');
  });

  it('can drop an attribute', async () => {
    const schema = {
      students: S.Schema({
        id: S.number(),
        name: S.string(),
      }),
    };
    const db = new DB({ source: new InMemoryTupleStorage(), schema: schema });
    await db.insert('students', { id: 1, name: 'Alice' }, 1);
    await db.dropAttribute({ collection: 'students', path: 'id' });
    const dbSchema = await db.getSchema();
    expect(dbSchema).toHaveProperty('students');
    expect(dbSchema.students.properties).not.toHaveProperty('id');
    expect(dbSchema.students.properties).toHaveProperty('name');

    // TODO: test data is actually dropped if we decide it should be
  });
});

describe('migrations', () => {
  const migrations: Migration[] = [
    {
      parent: 0,
      version: 1,
      up: [
        [
          'create_collection',
          {
            name: 'students',
            attributes: {
              id: { type: 'number' },
              name: { type: 'string' },
            },
          },
        ],
      ],
      down: [['drop_collection', { name: 'students' }]],
    },
    {
      parent: 1,
      version: 2,
      up: [
        [
          'create_collection',
          {
            name: 'classes',
            attributes: {
              id: { type: 'number' },
              department: { type: 'string' },
            },
          },
        ],
      ],
      down: [['drop_collection', { name: 'classes' }]],
    },
  ];
  it('initializing a DB with migrations sets the schema', async () => {
    const db = new DB({ migrations });
    const dbSchema = await db.getSchema();
    expect(dbSchema).toHaveProperty('students');
    expect(dbSchema).toHaveProperty('classes');
    expect((await db.tripleStore.readSchema())?.version).toEqual(2);
  });
  it('will stop migrating on an error and rollback changes', async () => {
    const migrationsCopy = JSON.parse(
      JSON.stringify(migrations)
    ) as Migration[];
    migrationsCopy[1].up.push([
      'bad_op',
      {
        arg: 'foo',
      },
    ]);
    const db = new DB({ migrations: migrationsCopy });
    const dbSchema = await db.getSchema();
    expect(dbSchema).toHaveProperty('students');
    expect(dbSchema).not.toHaveProperty('classes');
    const tripleStoreVersion = (await db.tripleStore.readSchema())?.version;
    expect(tripleStoreVersion).toEqual(1);
  });

  it('will only run migrations if version and parent pointer match', async () => {
    const migration01 = { parent: 0, version: 1, up: [], down: [] };
    const migration12 = { parent: 1, version: 2, up: [], down: [] };
    const migration13 = { parent: 1, version: 3, up: [], down: [] };
    const migration23 = { parent: 2, version: 3, up: [], down: [] };
    const migration34 = { parent: 3, version: 4, up: [], down: [] };

    // Standard case
    const migrationsLinked = [
      migration01,
      migration12,
      migration23,
      migration34,
    ];
    // Branch at 1->2, 1->3, must apply a migration with parent 2 to continue
    const migrationsUnlinked = [
      migration01,
      migration12,
      migration13,
      migration34,
    ];
    // Skip 1->3, continue with 2->3
    const migrationsAll = [
      migration01,
      migration12,
      migration13,
      migration23,
      migration34,
    ];

    const dbLinked = new DB({ migrations: migrationsLinked });
    const dbUnlinked = new DB({ migrations: migrationsUnlinked });
    const dbAll = new DB({ migrations: migrationsAll });

    const dbLinkedSchema = await dbLinked.getSchema(true);
    const dbUnlinkedSchema = await dbUnlinked.getSchema(true);
    const dbAllSchema = await dbAll.getSchema(true);
    expect(dbLinkedSchema?.version).toEqual(4);
    expect(dbUnlinkedSchema?.version).toEqual(2);
    expect(dbAllSchema?.version).toEqual(4);

    const linkedMigration = { parent: 4, version: 5, up: [], down: [] };
    const unlinkedMigration = { parent: 3, version: 5, up: [], down: [] };

    await dbAll.migrate([unlinkedMigration], 'up');
    const dbAllSchemaAfter = await dbAll.tripleStore.readSchema();
    expect(dbAllSchemaAfter?.version).toEqual(4);

    await dbAll.migrate([linkedMigration], 'up');
    const dbAllSchemaAfter2 = await dbAll.tripleStore.readSchema();
    expect(dbAllSchemaAfter2?.version).toEqual(5);

    // TODO: I think this would fail because migration would be applied since we dont actually store the migrations that were applied
    // dbAll.migrate([unlinkedMigration], 'down');
    // expect(dbAll.tripleStore.schema?.version).toEqual(5);
    await dbAll.migrate([linkedMigration], 'down');
    const dbAllSchemaAfter3 = await dbAll.tripleStore.readSchema();
    expect(dbAllSchemaAfter3?.version).toEqual(4);

    await dbAll.migrate([unlinkedMigration], 'down');
    const dbAllSchemaAfter4 = await dbAll.tripleStore.readSchema();
    expect(dbAllSchemaAfter4?.version).toEqual(4);
  });

  describe('Data deletion', () => {
    it('clear() removes all data from the database', async () => {
      // Schema provides us with metadata to delete
      const schema = {
        students: S.Schema({
          id: S.number(),
          name: S.string(),
        }),
      };
      const storage = new InMemoryTupleStorage();
      const db = new DB({ source: storage, schema: schema });
      await db.insert('students', { id: 1, name: 'Alice' }, 1);

      expect(storage.data.length).not.toBe(0);

      await db.clear();

      expect(storage.data.length).toBe(0);
    });
  });
});
