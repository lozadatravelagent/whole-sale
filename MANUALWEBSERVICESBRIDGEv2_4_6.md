> ![](vertopal_2ee30bc2c4d14d0ea79738b442c99bcd/media/image1.png){width="2.925in"
> height="0.7861111111111111in"}
>
> ![](vertopal_2ee30bc2c4d14d0ea79738b442c99bcd/media/image2.png){width="2.7402777777777776in"
> height="0.8027777777777778in"}
>
> ***XML* INTERFACE**
>
> XML GUIA DEL USUARIO\
> SOFTUR S.A. Venezuela 1257 Piso 5 Of i, Buenos Aires Argentina
> www.softur.com.ar
>
> **INDICE**
>
> **1. GENERALIDADES**\
> **2. WORKFLOWS**\
> **3. SERVICIOS Y METODOS DISPONIBLES**\
> **4. HERRAMIENTAS DE DESARROLLO**\
> **5. REQUERIMIENTOS WEB SERVICE**\
> **6. OPERACIONES**\
> **7. PROCESO DE CERTIFICACION**
>
> **1. GENERALIDADES**
>
> WebServices es una manera de publicar en Internet consultas y
> actualizaciones contra la base de datos Traffic, las cuales se podrán
> invocar por páginas ASP o PHP y obtener como resultado:

+-----------------------------------+-----------------------------------+
| > •\                              | > Estado\                         |
| > •\                              | > Código de error\                |
| > •                               | > Conjunto de registros           |
|                                   | > resultante con formato XML      |
|                                   | > simple.                         |
+===================================+===================================+
+-----------------------------------+-----------------------------------+

> Los desarrolladores tomaran la información y la visualizaran según
> parámetros de diseños pre establecidos por el usuario.
>
> Cada una de las consultas y actualizaciones necesitara el envío de
> parámetros los cuales se indicaran por especificaciones técnicas según
> **"Servicios Disponibles y Métodos**"
>
> Tener en cuenta que el servicio provisto por SOFTUR es totalmente no
> visual, o sea que toda la entrada y salida de datos requerida deberá
> desarrollarse por vuestro personal (interno o externo).
>
> **2. WORKFLOWS**
>
> **PRESUPUESTO/RESERVAR**
>
> ![](vertopal_2ee30bc2c4d14d0ea79738b442c99bcd/media/image3.png){width="6.116666666666666in"
> height="2.3069444444444445in"}
>
> **3. SERVICIOS DISPONIBLES Y METODOS**
>
> **[RECUPERAR]{.underline}**
>
> **[DATOS ESTATICOS]{.underline}**\
> **[getAirlineList]{.underline}**\
> Lista las Líneas aéreas\
> **[getCountryList]{.underline}**\
> Devuelve listado de Paises y Ciudades Publicadas
>
> **[PRESUPUESTOS]{.underline}**\
> **[getBudgetList]{.underline}**\
> Dado x parámetros devuelve lista de Presupuestos\
> **[getBudget]{.underline}**\
> Dado un ID de Presupuesto devuelve los Datos del mismo
>
> **[RESERVAS]{.underline}**\
> **[getBookingList]{.underline}**\
> Dado x cantidad de Parámetros devuelve lista de Reservas
> **[getBooking]{.underline}**\
> Dado un ID de Reserva devuelve los Datos de la misma
>
> **[TARIFAS]{.underline}**\
> **[getHotelFare]{.underline}**\
> Dado un ID de Tarifa devuelve Datos de Tarifas\
> **[getPackageFare]{.underline}**\
> Dado un ID de Paquete devuelve Datos de Paquetes\
> **[getServiceFare]{.underline}**\
> Dado un ID de Servicios devuelve Datos de Servicios\
> **[getAirFare]{.underline}**\
> Dado un ID de Tarifa de Aéreo devuelve los Datos del precio.-
>
> **[BUSQUEDA DE TARIFAS]{.underline}**
>
> **[searchAirFares]{.underline}**\
> Busca Transporte Aéreo y Terrestre\
> **[searchHotelFares]{.underline}**\
> Busca según parámetros (Ciudad, Fecha, Usuario, Clave, Ciudad,
> Ocupación) y devuelve Tarifas del BackOffice y Brokers Hoteleros
> Contratados.-\
> **[searchPackageFares]{.underline}**\
> Devuelve Tarifas del Sistema BackOffice.-\
> **[searchServiceFares]{.underline}**\
> Dado un Tipo de Servicio (Excursión, Transfer, Otros), una Ciudad,
> Fecha, Usuario y Clave, devuelve Tarifas con disponibilidades.-
>
> **[PRESUPUESTOS]{.underline}**
>
> **[addEvent]{.underline}**\
> Adiciona un Eventual.
>
> **[makeBudget]{.underline}**\
> Con x parámetros de Presupuesto genera un Presupuesto en el BackOffice
> **[convertToBooking]{.underline}**\
> Pasa la Cotización a formato Reserva
>
> **[RESERVAS]{.underline}**
>
> **[COMENTARIOS]{.underline}**\
> **[addBookingComment]{.underline}**\
> Agrega Comentario a la Reserva.-\
> **[ackBookingComment]{.underline}**\
> Marca como Leido el Comentario.
>
> **[PAXS]{.underline}**\
> **[addBookingPassenger]{.underline}**\
> Agrega Pasajero a la Reserva.-\
> **[modBookingPassenger]{.underline}**\
> Modifica Pasajero en la Reserva\
> **[delBookingPassenger]{.underline}**\
> Borra Pasajero
>
> **[VUELOS]{.underline}**\
> **[addBookingTransportInfo]{.underline}**\
> Agrega Vuelos (desde el Back office) a la
> Reserva.-**[modBookingTransportInfo]{.underline}**\
> Modifica la Información de Transporte en la Reserva
> **[delBookingTransportInfo]{.underline}**\
> Borra Vuelo
>
> **4. HERRAMIENTAS DE DESARROLLO**
>
> La descripción del Web Server (WSDL) y las definiciones de los
> esquemas XML (XSD) se pueden encontrar en:
>
> [http://www.softur.com.ar/wsbridge/budget.wsdl]{.underline}
>
> El acceso al Servicio Web será por esta dirección:
>
> [http://net.softur.com.ar/WSBridge/BridgeService.asmx]{.underline}
>
> usuario : TESTEO\
> clave : TESTEO
>
> En nuestra experiencia desarrollando y soportando aplicaciones
> relacionadas con web services y/o networking en general, hemos
> encontrado que es muy práctico (o casi necesario) disponer de algunas
> herramientas específicas para capturar y analizar el tráfico de red y
> para probar/depurar web services SOAP.
>
> En este sentido, podemos sugerir las siguientes herramientas, todas
> gratis, la mayoría disponibles para múltiples sistemas operativos:
>
> \_ Para capturar/analizar tráfico de red en general, un popular
> .sniffer. es: WireShark. Esta herramienta suele formar parte de muchas
> distribuciones GNU/Linux, pero también puede obtenerse una versión
> binaria para Windows en:
>
> [http://www.wireshark.org/]{.underline}
>
> \_ Para capturar/analizar tráfico HTTP en particular, una herramienta
> más limitada pero más simple de utilizar es: Fiddler. Esta herramienta
> sólo está disponible para entornos Windows y se puede descargar en:
>
> [http://www.fiddler2.com/fiddler2/]{.underline}
>
> \_ Para probar/depurar web services SOAP, una herramienta que ha
> probado ser muy útil es: soapUI. Esta herramienta puede obtenerse en:
>
> [http://www.soapui.org/]{.underline}
>
> Todas estas herramientas son de libre disponibilidad y en nuestra
> experiencia y la de otros usuarios, han probado ser muy útiles, pero
> no asumimos ninguna responsabilidad sobre su funcionalidad ni estamos
> en condiciones de dar soporte ni contestar consultas sobre su uso.
>
> 5\. **REQUERIMIENTOS WEBSERVICE**
>
> Servidor

+-----------------------+-----------------------+-----------------------+
| •                     | > **Hardware**:       |                       |
|                       |                       |                       |
| •                     |                       |                       |
|                       |                       |                       |
| •                     |                       |                       |
+=======================+=======================+=======================+
|                       | o                     | > PC Pentium IV, AMD  |
|                       |                       | > Atlon 5200 x 2 Dual |
|                       |                       | > Coreo Superior.     |
+-----------------------+-----------------------+-----------------------+
|                       | o                     | > Motherboard con     |
|                       |                       | > soporte SATA 2      |
+-----------------------+-----------------------+-----------------------+
|                       | o                     | > 2 Gb RAM o superior |
+-----------------------+-----------------------+-----------------------+
|                       | o                     | > HD 160 SATA 2 o     |
|                       |                       | > superior            |
+-----------------------+-----------------------+-----------------------+
|                       | o                     | > Resolución de       |
|                       |                       | > pantalla de al      |
|                       |                       | > menos 800 x 600     |
+-----------------------+-----------------------+-----------------------+
|                       | > **Software**:       |                       |
+-----------------------+-----------------------+-----------------------+
|                       | o                     | Windows 2000 Server / |
|                       |                       | Advanced Server.      |
|                       |                       | Servicio Terminal     |
|                       |                       | Server habilitado     |
|                       |                       | para                  |
+-----------------------+-----------------------+-----------------------+
|                       | > conexiones remotas  |                       |
|                       | > y soporte técnico   |                       |
|                       | > posterior.          |                       |
+-----------------------+-----------------------+-----------------------+
|                       | o                     | > Windows 2003        |
|                       |                       | > Server. Servicio    |
|                       |                       | > Terminal Server     |
|                       |                       | > habilitado para     |
|                       |                       | > conexiones remotas  |
+-----------------------+-----------------------+-----------------------+
|                       | > y soporte técnico   |                       |
|                       | > posterior.          |                       |
|                       | >                     |                       |
|                       | > **Conexión          |                       |
|                       | > Remota**:           |                       |
|                       | > Escritorio Remoto   |                       |
+-----------------------+-----------------------+-----------------------+

> **6.OPERACIONES**\
> **6.1.GENERALES**\
> En todos los request se necesita la identidad, estos campos son
> obligatorios.
>
> ![](vertopal_2ee30bc2c4d14d0ea79738b442c99bcd/media/image4.png){width="3.145832239720035in"
> height="0.6361111111111111in"}

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **Id** Obligatorio. Es el id con el cual ud esta registrado.        |
+-----------------------------------------------------------------------+
| > **Clave** Obligatorio. Es la clave que le fue enviada.              |
+-----------------------------------------------------------------------+

> En todos los response se devuelve un nodo Resultado
>
> ![](vertopal_2ee30bc2c4d14d0ea79738b442c99bcd/media/image5.png){width="3.126388888888889in"
> height="0.6277766841644794in"}

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **codigo** 0 - No occurio error                                     |
+-----------------------------------------------------------------------+
| > **texto** Vacio o con el texto de error ocurrido.                   |
+-----------------------------------------------------------------------+

> **6.2.getAirlineList**\
> 6.2.1.REQUEST
>
> \<xsstring10 \>\
> \<pos\>\
> \<id\>TESTEO\</id\>\
> \<clave\>TESTEO\</clave\>\
> \</pos\>\
> \</xsstring10\>
>
> 6.2.2.RESPONSE
>
> \<ArrayOfAirlineInfo1\>\
> \<AirlineInfos\>\
> \<Code\>AR\</Code\>\
> \<Name\>AEROLINEAS ARGENTINA\</Name\>\
> \</AirlineInfos\>\
> \<resultado\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \</ArrayOfAirlineInfo1\>
>
> **6.3. getCountryList**\
> **6.3.1. REQUEST**
>
> \<xsstring7\>\
> \<pos\>\
> \<id\>smart3\</id\>\
> \<clave\>smart3ws\</clave\>\
> \</pos\>\
> \<dateFrom\>2012-10-01\</dateFrom\>\
> \<dateTo\>2012-10-31\</dateTo\>\
> \<activeFareType\>PAQUETE\</activeFareType\>\
> \<activeFareSubtype\>AEROTERRESTRE\</activeFareSubtype\>
> \</xsstring7\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  | **Descripcion**                |   |
| |   **Campo**                    |                                |   |
| |   ---------------------------  |                                |   |
| |                                |                                |   |
| |   ---------------------------  |                                |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **Pos** Credeciales                                                 |
+-----------------------------------------------------------------------+
| > **dateFrom/dateTo** Periodo a Buscar                                |
+-----------------------------------------------------------------------+
| > **activeFareType** AEREO, HOTEL, PAQUETE o SERVICIO.                |
+-----------------------------------------------------------------------+
| > **activeFareSubType** AEROTERRESTRE, TERRESTRE o CIRCUITO.          |
+-----------------------------------------------------------------------+

> **6.3.2. RESPONSE**
>
> \<ArrayOfCountryInfo1
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.wsdl\"\>\
> \<CountryInfos xmlns=\"\"\>\
> \<Code
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>A0\</Code\>
> \<Name
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>ALBANIA\</Name\>
> \<CityList xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<City\>\
> \<Code\>T09\</Code\>\
> \<Name\>TIRANA\</Name\>\
> \</City\>\
> \</CityList\>\
> \</CountryInfos\>\
> \<CountryInfos xmlns=\"\"\>\
> \<Code
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>A3\</Code\>
> \<Name xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>ARABIA
> SAUDÍ\</Name\>\
> \<CityList xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<City\>\
> \<Code\>A0A\</Code\>\
> \<Name\>ABHA\</Name\>\
> \</City\>\
> \<City\>\
> \<Code\>A0B\</Code\>\
> \<Name\>AL KHOBAR\</Name\>\
> \</City\>\
> \<City\>\
> \<Code\>A0C\</Code\>\
> \<Name\>AL HOFUF\</Name\>\
> \</City\>\
> \</CityList\>\
> \</CountryInfos\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \</ArrayOfCountryInfo1\>
>
> **6.3.3. Observaciones**
>
> Si se especifica el periodo y el tipo de Fare, solo de devuelven los
> destinos que tiene tarifas en ese periodo.
>
> **6.4.getBudgetList**\
> **6.4.1.REQUEST**
>
> \<getBudgetListRQ
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<pos\>\
> \<id\>TESTEO\</id\>\
> \<clave\>TESTEO\</clave\>\
> \</pos\>\
> \<rq\>00734\</rq\>\
> \</getBudgetListRQ\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **rq** agencia/cliente                                              |
+-----------------------------------------------------------------------+

> **6.4.2.RESPONSE**
>
> \<getBudgetListRS
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<resultado\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<Budgets UniqueId=\"00020000385\"\>\
> \<Summary\
> ItineraryCode=\"O11519\"\
> CreationDate=\"2006-12-05T00:00:00\"\
> ModificationDate=\"1900-01-01T00:00:00\"\
> StartDate=\"2038-01-18\"\
> User=\"Paola Grismado"\
> Reference=\"COMPLETAR\"\
> Status=\"0\"\
> Comments=\"\"\
> Agent=\"00734\"\
> Currency=\"USD\"\
> VendorInfo=\"AMENDOLARI, SILVIA\"\>\
> \<Pricing\>\
> \<NonCommissionableService\>\
> \<Description /\>\
> \<Amount\>0\</Amount\>\
> \</NonCommissionableService\>\
> \<TourismTaxes\>\
> \<Description /\>\
> \<Base\>0\</Base\>\
> \<Rate\>0\</Rate\>\
> \<Amount\>0\</Amount\>\
> \</TourismTaxes\>\
> \<FiscalTaxes\>\
> \<Description /\>\
> \<Base\>0\</Base\>\
> \<Rate\>0\</Rate\>\
> \<Amount\>0\</Amount\>\
> \</FiscalTaxes\>\
> \<CommissionablePrice\>1638\</CommissionablePrice\>
> \<CommissionAmount\>0\</CommissionAmount\>\
> \<OverrideCommissionAmount\>0\</OverrideCommissionAmount\>
> \<Total\>1884.31\</Total\>\
> \<Target\>AGENCY\</Target\>\
> \</Pricing\>\
> \</Summary\>\
> \</Budgets\>\
> \</getBudgetListRS\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **Uniqueid** Codigo identificador el Presupuesto                    |
+-----------------------------------------------------------------------+
| > **IteneraryCode** Codigo Traffic                                    |
+-----------------------------------------------------------------------+

> **6.4.3.Observaciones**\
> Con este método se buscan todos los presupuestos que hizo la agencia,
> obteniendo el uniqueid para poder llamar al getBudget de algun
> presupuesto.
>
> **6.5.getBudget**\
> **6.5.1.**Request
>
> \<getBudgetRQ xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>
>
> \<pos\>\
> \<id\>TESTEO\</id\>\
> \<clave\>TESTEO\</clave\>\
> \</pos\>\
> \<rq\>00020029035\</rq\>\
> \</getBudgetRQ\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **rq** Codigo identificador el Presupuesto                          |
+-----------------------------------------------------------------------+

> **6.5.2.**Response
>
> \<BudgetType2 xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<resultado\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<rs UniqueId=\"00020029035\"\>\
> \<HotelBudget ItemId=\"001\"\>\
> \<FareId\>EV00020002059\</FareId\>\
> \<InDate\>2010-05-24\</InDate\>\
> \<OutDate\>2010-05-29\</OutDate\>\
> \<SubTotalAmount\>360.54\</SubTotalAmount\>\
> \<FareTypeSelectionList\>\
> \<FareTypeSelection type=\"Double Room (sole Use) /Room and
> breakfast\"OccupancyId=\"1\"\>1\</FareTypeSelection\>\
> \<Ocuppancy OccupancyId=\"1\"\>\
> \<Occupants type=\"ADT\"/\>\
> \</Ocuppancy\>\
> \</FareTypeSelectionList\>\
> \</HotelBudget\>\
> \<Summary ItineraryCode=\"O36970\"CreationDate=\"2010-04-08T00:00:00\"
> ModificationDate=\"2010-04-08T00:00:00\"StartDate=\"2010-05-24\"User=\"TEST\"
> Reference=\"HOTEL Nueva Interfaz
> Grab.\"Status=\"0\"Comments=\"Comentario Hotel Nueva
> Interfaz\"Agent=\"00734\"Currency=\"USD\"VendorInfo=\"PRUEBA\"\>\
> \<Pricing\>\
> \<NonCommissionableService\>\
> \<Description\>GASTOS GASTOS DE RESERVA EUROPA Y ORIENTE
> MEDIO\</Description\>\
> \<Amount\>10\</Amount\>\
> \</NonCommissionableService\>\
> \<NonCommissionableService\>\
> \<Description\>GASTOS \-- GASTOS ADMINISTRATIVOS \</Description\>\
> \<Amount\>4.63\</Amount\>\
> \</NonCommissionableService\>\
> \<FiscalTaxes\>\
> \<Description\>EXENTOS TRANSPORTES\</Description\>
> \<Base\>10\</Base\>\
> \<Rate\>0\</Rate\>\
> \<Amount\>0\</Amount\>\
> \</FiscalTaxes\>\
> \<FiscalTaxes\>\
> \<Description\>NO GRAVADO\</Description\>\
> \<Base\>299.25\</Base\>\
> \<Rate\>0\</Rate\>\
> \<Amount\>0\</Amount\>\
> \</FiscalTaxes\>\
> \<FiscalTaxes\>\
> \<Description\>GRAVADO\</Description\>\
> \<Base\>65.92\</Base\>\
> \<Rate\>21\</Rate\>\
> \<Amount\>13.84\</Amount\>\
> \</FiscalTaxes\>
>
> \<CommissionablePrice\>360.54\</CommissionablePrice\>
> \<CommissionAmount\>0\</CommissionAmount\>\
> \<OverrideCommissionAmount\>0\</OverrideCommissionAmount\>
> \<Total\>389.01\</Total\>\
> \<Target\>AGENCY\</Target\>\
> \</Pricing\>\
> \<Pricing\>\
> \<NonCommissionableService\>\
> \<Description\>GASTOS GASTOS DE RESERVA EUROPA Y ORIENTE
> MEDIO\</Description\>\
> \<Amount\>10\</Amount\>\
> \</NonCommissionableService\>\
> \<NonCommissionableService\>\
> \<Description\>GASTOS \-- GASTOS ADMINISTRATIVOS \</Description\>\
> \<Amount\>4.63\</Amount\>\
> \</NonCommissionableService\>\
> \<FiscalTaxes\>\
> \<Description\>EXENTOS TRANSPORTES\</Description\>
> \<Base\>10\</Base\>\
> \<Rate\>0\</Rate\>\
> \<Amount\>0\</Amount\>\
> \</FiscalTaxes\>\
> \<FiscalTaxes\>\
> \<Description\>NO GRAVADO\</Description\>\
> \<Base\>299.25\</Base\>\
> \<Rate\>0\</Rate\>\
> \<Amount\>0\</Amount\>\
> \</FiscalTaxes\>\
> \<FiscalTaxes\>\
> \<Description\>GRAVADO\</Description\>\
> \<Base\>65.92\</Base\>\
> \<Rate\>21\</Rate\>\
> \<Amount\>13.84\</Amount\>\
> \</FiscalTaxes\>\
> \<CommissionablePrice\>360.54\</CommissionablePrice\>
> \<CommissionAmount\>0\</CommissionAmount\>\
> \<OverrideCommissionAmount\>0\</OverrideCommissionAmount\>
> \<Total\>389.01\</Total\>\
> \<Target\>PASSENGER\</Target\>\
> \</Pricing\>\
> \</Summary\>\
> \</rs\>\
> \</BudgetType2\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **uniqueid** Codigo identificador el Presupuesto                    |
+-----------------------------------------------------------------------+
| > **itemID** Numero del item del presupuesto                          |
+-----------------------------------------------------------------------+
| > **fareId** Id de la Tarifa                                          |
+-----------------------------------------------------------------------+
| > **SubTotalAmount** Importe del item                                 |
+-----------------------------------------------------------------------+
| > **Total** Importe total del Presupuesto                             |
+-----------------------------------------------------------------------+

> **6.5.3.**Observaciones
>
> Según el tipo de ítem que se presupuesto, será el tipo de objeto en el
> item, pudiendo ser del tipo Package, Air, Hotel o Service.

+-----------------------------------------------------------------------+
| > 6.6. **getBookingList**                                             |
+=======================================================================+
+-----------------------------------------------------------------------+

> 6.6.1. **Request**
>
> \<getBookingListRQ\>\
> \<pos\>\
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<rq\>00734\</rq\>\
> \</getBookingListRQ\>
>
> 6.6.2. **Response**
>
> \<getBookingListRS\>\
> \<resultado\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<Bookings UniqueId=\"00020006348\"\>\
> \<Summary
> Status=\"\"BackOfficeBookingNumber=\"B10259\"TimeStamp=\"2010-04-09\"
> Modifiable=\"true\"Searchable=\"true\"Cancellable=\"true\"Closed=\"true\"BookingDate=\"2006-11-29\"
> StartDate=\"2007-02-03\"TimeLimit=\"2006-12-01\"DocumentationStatus=\"NO
> EMITIDA\"User=\"CECILIA\"
> Agent=\"00734\"Currency=\"ARS\"Balance=\"0\"ModificationDate=\"2006-11-29T10:37:18\"\
> Reference=\"Reference 2\"VendorInfo=\"TEST\"/\>\
> \</Bookings\>\
> \<Bookings UniqueId=\"00020013158\"\>\
> \<Summary
> Status=\"\"BackOfficeBookingNumber=\"SG0002\"TimeStamp=\"2010-04-09\"
> Modifiable=\"true\"Searchable=\"true\"Cancellable=\"true\"Closed=\"true\"BookingDate=\"2007-03-07\"
> StartDate=\"2007-03-07\"TimeLimit=\"2007-03-09\"DocumentationStatus=\"NO
> EMITIDA\"User=\"\"
> Agent=\"00734\"Currency=\"ARS\"Balance=\"0\"ModificationDate=\"2007-03-07T17:47:05\"\
> Reference=\"Reference 1\"VendorInfo=\"Florencia\"/\>\
> \</Bookings\>\
> \<Bookings UniqueId=\"00020018632\"\>\
> \<Summary
> Status=\"\"BackOfficeBookingNumber=\"RA1549\"TimeStamp=\"2010-04-09\"
> Modifiable=\"true\"Searchable=\"true\"Cancellable=\"true\"Closed=\"true\"BookingDate=\"2007-05-30\"
> StartDate=\"2007-07-06\"TimeLimit=\"2007-06-01\"DocumentationStatus=\"NO
> EMITIDA\"User=\"\"
> Agent=\"00734\"Currency=\"ARS\"Balance=\"0\"Reference=\"Reference
> 1\"VendorInfo=\"TEST\"/\> \</Bookings\>\
> \</getBookingListRS\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **uniqueid** Codigo identificador de la Reserva                     |
+-----------------------------------------------------------------------+
| > **BackOfficeBookingNumber** Codigo Traffic de la Reserva.           |
+-----------------------------------------------------------------------+

> 6.6.3. **Observaciones**
>
> 6.7. **getBooking**\
> 6.7.1. **Request**
>
> \<getBookingRQ\>\
> \<pos\>\
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<rq\>00020116069\</rq\>\
> \</getBookingRQ\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **rq** Codigo identificador de la Reserva.                          |
+-----------------------------------------------------------------------+

> 6.7.2. **Response**
>
> \<BookingType2 xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<resultado\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<rs UniqueId=\"00020116069\"\>\
> \<Services\>\
> \<HotelBooking ItemId=\"001\"\>\
> \<FareId\>EV00020002059\</FareId\>\
> \<InDate\>2010-05-24\</InDate\>\
> \<OutDate\>2010-05-29\</OutDate\>\
> \<SubTotalAmount\>360.54\</SubTotalAmount\>
>
> \<FareTypeSelectionList\>\
> \<FareTypeSelection type=\"Double Room (sole Use) /Room and
> breakfast\"OccupancyId=\"1\"\>1\</FareTypeSelection\>\
> \<Ocuppancy OccupancyId=\"1\"\>\
> \<Occupants type=\"ADT\"/\>\
> \</Ocuppancy\>\
> \</FareTypeSelectionList\>\
> \<Status\>OK\</Status\>\
> \<ConfirmationNumber\>2067737\</ConfirmationNumber\>\
> \<BlockingNumber /\>\
> \<ConfirmedBy /\>\
> \<Modifiable\>false\</Modifiable\>\
> \<Searchable\>true\</Searchable\>\
> \<Cancellable\>true\</Cancellable\>\
> \<Acceptable\>true\</Acceptable\>\
> \<Rejectable\>true\</Rejectable\>\
> \<Availability /\>\
> \<DocumentationStatus\>NO EMITIDO\</DocumentationStatus\>\
> \<Read\>true\</Read\>\
> \</HotelBooking\>\
> \</Services\>\
> \<Passengers\>\
> \<ServiceRef /\>\
> \<CommentRef /\>\
> \<TransportInfoRef /\>\
> \<Id\>00020277788\</Id\>\
> \<LastName\>pruebauno\</LastName\>\
> \<FirstName\>uno\</FirstName\>\
> \<MiddleName\>\</MiddleName\>\
> \<InvoicingCustomer\>00734\</InvoicingCustomer\>

+-----------------------+-----------------------+-----------------------+
| \<Address\>           | \</Town\>             | > \</Address\>        |
+=======================+=======================+=======================+
| \<Town\>              |                       |                       |
+-----------------------+-----------------------+-----------------------+
| \<ZipCode\>           | \</City\>             | > \</ZipCode\>        |
+-----------------------+-----------------------+-----------------------+
| \<City\>              |                       |                       |
+-----------------------+-----------------------+-----------------------+

> \<Nationality\>ARG\</Nationality\>\
> \<DocType\>Pas\</DocType\>\
> \<DocNumber\>00 \</DocNumber\>

+-----------------------+-----------------------+-----------------------+
| \<Occupation\>        | \</Role\>             | > \</Occupation\>     |
+=======================+=======================+=======================+
| \<Role\>              |                       | > \</Company\>        |
+-----------------------+-----------------------+-----------------------+
| \<Company\>           |                       |                       |
+-----------------------+-----------------------+-----------------------+

> \<Sex\>M\</Sex\>\
> \<BirthDate\>1968-09-20\</BirthDate\>\
> \<PassportExpiration\>1900-01-01\</PassportExpiration\>\
> \<DateFrom\>1900-01-01\</DateFrom\>\
> \<VisaDateOfIssue\>01/01/1900 12:00:00 a.m.\</VisaDateOfIssue\>\
> \<PassengerType\>ADT\</PassengerType\>\
> \<Attributes\>\
> \<Code\>TEPA\</Code\>\
> \<Description\>Telefono Particular\</Description\>\
> \<Value\> \</Value\>\
> \</Attributes\>\
> \<Attributes\>\
> \<Code\>EMAI\</Code\>\
> \<Description\>E-mail Oficina\</Description\>\
> \<Value\>\
> \</Value\> \</Attributes\>\
> \</Passengers\>\
> \<Documents\>\
> \<Id\>F00020299924\</Id\>\
> \<DocDate\>2011-10-28\</DocDate\>\
> \<DocType\>FAC A\</DocType\>\
> \<DocNumber\>37602\</DocNumber\>\
> \<DocAmounts\>\
> \<Currency\>P\</Currency\>\
> \<Amount\>855.4\</Amount\>\
> \<ROE\>4.26\</ROE\>\
> \</DocAmounts\>\
> \<File\>JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvUGFnZX...\</File\>\
> \</Documents\>\
> \<Summary
> Status=\"FC\"BackOfficeBookingNumber=\"R30091\"TimeStamp=\"2010-04-09\"
> Modifiable=\"true\"Searchable=\"true\"Cancellable=\"true\"Closed=\"true\"BookingDate=\"2010-04-08\"
> StartDate=\"2010-05-24\"TimeLimit=\"2010-04-11\"DocumentationStatus=\"NO
> EMITIDA\"User=\"
> \"Agent=\"00734\"Currency=\"USD\"Balance=\"389.01\"ModificationDate=\"1900-01-01T00:00:00\"
> Reference=\"pruebauno uno\"VendorInfo=\"TEST\"\>\
> \<Pricing\>\
> \<NonCommissionableService\>\
> \<Description\>GASTOS GASTOS DE RESERVA EUROPA Y ORIENTE
> MEDIO\</Description\>\
> \<Amount\>10\</Amount\>\
> \</NonCommissionableService\>\
> \<NonCommissionableService\>\
> \<Description\>GASTOS \-- GASTOS ADMINISTRATIVOS\
> \</Description\>
>
> \<Amount\>4.63\</Amount\>\
> \</NonCommissionableService\>\
> \<FiscalTaxes\>\
> \<Description\>EXENTOS TRANSPORTES\</Description\>
> \<Base\>10\</Base\>\
> \<Rate\>0\</Rate\>\
> \<Amount\>0\</Amount\>\
> \</FiscalTaxes\>\
> \<FiscalTaxes\>\
> \<Description\>NO GRAVADO\</Description\>\
> \<Base\>299.25\</Base\>\
> \<Rate\>0\</Rate\>\
> \<Amount\>0\</Amount\>\
> \</FiscalTaxes\>\
> \<FiscalTaxes\>\
> \<Description\>GRAVADO\</Description\>\
> \<Base\>65.92\</Base\>\
> \<Rate\>21\</Rate\>\
> \<Amount\>13.84\</Amount\>\
> \</FiscalTaxes\>\
> \<CommissionablePrice\>360.54\</CommissionablePrice\>\
> \<CommissionAmount\>0\</CommissionAmount\>\
> \<OverrideCommissionAmount\>0\</OverrideCommissionAmount\>
> \<Total\>389.01\</Total\>\
> \<Target\>AGENCY\</Target\>\
> \</Pricing\>\
> \<Pricing\>\
> \<NonCommissionableService\>\
> \<Description\>GASTOS GASTOS DE RESERVA EUROPA Y ORIENTE
> MEDIO\</Description\>\
> \<Amount\>10\</Amount\>\
> \</NonCommissionableService\>\
> \<NonCommissionableService\>\
> \<Description\>GASTOS \-- GASTOS ADMINISTRATIVOS \</Description\>\
> \<Amount\>4.63\</Amount\>\
> \</NonCommissionableService\>\
> \<FiscalTaxes\>\
> \<Description\>EXENTOS TRANSPORTES\</Description\>
> \<Base\>10\</Base\>\
> \<Rate\>0\</Rate\>\
> \<Amount\>0\</Amount\>\
> \</FiscalTaxes\>\
> \<FiscalTaxes\>\
> \<Description\>NO GRAVADO\</Description\>\
> \<Base\>299.25\</Base\>\
> \<Rate\>0\</Rate\>\
> \<Amount\>0\</Amount\>\
> \</FiscalTaxes\>\
> \<FiscalTaxes\>\
> \<Description\>GRAVADO\</Description\>\
> \<Base\>65.92\</Base\>\
> \<Rate\>21\</Rate\>\
> \<Amount\>13.84\</Amount\>\
> \</FiscalTaxes\>\
> \<CommissionablePrice\>360.54\</CommissionablePrice\>\
> \<CommissionAmount\>0\</CommissionAmount\>\
> \<OverrideCommissionAmount\>0\</OverrideCommissionAmount\>
> \<Total\>389.01\</Total\>\
> \<Target\>PASSENGER\</Target\>\
> \</Pricing\>\
> \</Summary\>\
> \</rs\>\
> \</BookingType2\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **status** Estado del item de la reserva. OK -- Confirmado.         |
| >                                                                     |
| > RQ -- A Requerir\                                                   |
| > AR -- Atencion Requerida, por algun problema no se pudo confirmar   |
| > en el broker\                                                       |
| > CL -- Cancelada                                                     |
+-----------------------------------------------------------------------+
| > **ConfirmationNumber** Nro de Reserva en el broker, con este numero |
| > en la pagina                                                        |
|                                                                       |
| del broker se puede encontrar la reserva.                             |
+-----------------------------------------------------------------------+

> 6.7.3. **Observaciones**
>
> **6.8. getHotelFare**\
> 6.8.1. Request
>
> \<xsstring2\>\
> \<pos\>\
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<currency\>USD\</currency\>\
> \<rq\>EV00020002059\</rq\>\
> \</xsstring2\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **currency** Codigo ISO de la Moneda.                               |
+-----------------------------------------------------------------------+
| > **rq** Id de la Tarifa, FareId                                      |
+-----------------------------------------------------------------------+

> Para el caso de un ítem que este dentro de una reserva o presupuesto,
> se debe pasar el id e ítem de la reserva o presupuesto en el campo
> bookingid o budgeid, ej.
>
> Una Reserva:\
> \<xsstring2\>\
> \<pos\>\
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<currency\>USD\</currency\>\
> \<bookingid\>00020116071-001\</ bookingid \>
> \<rq\>EV00020002062\</rq\>\
> \</xsstring2\>
>
> Un presupuesto:\
> \<xsstring2\>\
> \<pos\>\
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<currency\>USD\</currency\>\
> \<budgetid\>00020116071-001\</budgetid\>\<rq\>EV00020002062\</rq\>\
> \</xsstring2\>
>
> 6.8.2. Response
>
> \<smHotelFareType1
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<rs UniqueId=\"EV00020002513\"BackOfficeCode=\"025132\"\
> BackOfficeOperatorCode=\"00068\"xmlns=\"\"\>\
> \<Name\>SILVA\</Name\>\
> \<Category\>3\*\</Category\>\
> \<Location code=\"ROM\"\>Roma, Céntrico\</Location\>
>
> \<RoomFeatures\>Break Fast:Continental\</RoomFeatures\>
> \<CancelationPolicy\>\
> DOBLE DE USO INDIVIDUAL ESTÁNDAR /DESAYUNO INCLUIDO Cargo de
> Cancelación:\
> A partir del 30/11/2010 tiene un costo de 65,00 USD.
>
> Cargo de Modificación:\
> A partir del 30/11/2010 tiene un costo de 0,00 USD.
>
> Por favor, considere las diferencias horarias locales y haga sus
> cálculos en base a eso\</CancelationPolicy\>\
> \<LodgingPolicy\>Tarifas promocionales disponibles para estancias de 3
> noches o más desde el 01/11/2010 hasta el
> 29/12/2010\</LodgingPolicy\>\
> \<RoomType\>TS/B\</RoomType\>\
> \<HotelAddress\>VIA ANTONIO BOSIO 20/A,00185\
> ROME,ITALY,\</HotelAddress\>\
> \<HotelPhone\>39-06-44241938\</HotelPhone\>\
> \<Pictures type=\"web\"\>www.hotelsilva.com\</Pictures\>\
> \<Pictures type=\"img\"\>http://images.gta-\
> travel.com/HH/Images/E/MADth/MAD-OAS-2.jpg\</Pictures\>\
> \<Pictures type=\"img\"\>http://images.gta-\
> travel.com/HH/Images/E/MADth/MAD-OAS-4.jpg\</Pictures\>\
> \<Pictures type=\"img\"\>http://images.gta-\
> travel.com/HH/Images/E/MADth/MAD-OAS-1.jpg\</Pictures\>\
> \<Pictures type=\"img\"\>http://images.gta-\
> travel.com/HH/Images/E/MADth/MAD-OAS-3.jpg\</Pictures\>\
> \<FareList currency=\"USD\"\>\
> \<Fare PassengerType=\"ADT\"Availability=\"2\"OccupancyId=\"1\"\>
> \<Base\>195.00\</Base\>\
> \<Tax type=\"GRAVADO\"\>8.19\</Tax\>\
> \<Description\>doble de uso individual Estándar\
> /Desayuno incluido\</Description\>\
> \<dailyPrices\>\
> \<dailyPrice Date=\"2010-11-30\"\>65\</dailyPrice\> \<dailyPrice
> Date=\"2010-12-01\"\>65\</dailyPrice\> \<dailyPrice
> Date=\"2010-12-02\"\>65\</dailyPrice\> \</dailyPrices\>\
> \</Fare\>\
> \<Fare PassengerType=\"ADT\"Availability=\"2\"OccupancyId=\"2\"\>
> \<Base\>195.00\</Base\>\
> \<Tax type=\"GRAVADO\"\>8.19\</Tax\>\
> \<Description\>doble de uso individual Estándar\
> /Desayuno incluido\</Description\>\
> \<dailyPrices\>\
> \<dailyPrice Date=\"2010-11-30\"\>65\</dailyPrice\> \<dailyPrice
> Date=\"2010-12-01\"\>65\</dailyPrice\> \<dailyPrice
> Date=\"2010-12-02\"\>65\</dailyPrice\> \</dailyPrices\>\
> \</Fare\>\
> \<Ocuppancy OccupancyId=\"1\"\>\
> \<Occupants type=\"ADT\"/\>\
> \</Ocuppancy\>\
> \<Ocuppancy OccupancyId=\"2\"\>\
> \<Occupants type=\"ADT\"/\>\
> \</Ocuppancy\>\
> \</FareList\>\
> \<ValidFrom\>2010-11-30\</ValidFrom\>\
> \<ValidTo\>2010-12-03\</ValidTo\>\
> \<Observations\>El hotel está situado en una zona residencial
> tranquila, cerca del centro de Roma. El hotel Silva también está cerca
> de la hermosa y verde Villa Torlonia, a un par de minutos a pie de
> Piazza Bologna y de la estación de metro.
>
> Las habitaciones varían de tamaño. Están decoradas con buen gusto,
> tienen muebles modernos de madera y tapicerías elegantes. Se
> encuentran en excelente estado, al igual que los baños. Las paredes
> son blancas, en contraste con la alfombra azul. Las cortinas tienen
> rayas naranja y verde.
>
> El salón para desayunar es agradable aunque pequeño.
>
> Es una típica villa romana construida en los años 1920, recientemente
> restaurada y convertida en un pequeño hotel encantador.
>
> Es pequeño y está decorado con suaves colores pastel.
>
> Es una buena propiedad de 3 estrellas que se beneficia del hecho de
> ser una pequeña estructura, ofreciendo un ambiente relajado,
> tranquilo, con la chance de ser bien atendido por el personal
> profesional y agradable. Este hotel dispone de WI-FI gratis. 04/08 FR.
>
> Teléfonos\
> Hotel phone: 39-06-44241938\
> Fax number: 39-06-44292105
>
> Caracteristicas\
> Categoria: Turista Superior Clase Historico Hotel Estrellas: 3\
> Localización: Céntrico;
>
> Distancia\
> 1 kms del centro\
> 35 kms al aeropuerto (fiumicino)\
> 25 kms al aeropuerto (ciampino)\
> 2 minutos a pie hasta la parada de metro más cercana (plazza bologna)
> 1 km hasta la estación más cercana (termini)\
> 2 minutos a pie hasta la parada de autobús más cercana\
> 3 km hasta el Parque Ferial más cercano (fiera di roma)\
> 30 kms hasta la playa más cercana
>
> Facilidades del Hotel\
> Vestíbulo pequeño\
> Apertura de check-in 11:00\
> 2 plantas\
> Aparcamiento de Autobuses\
> Aparcamiento (A pagar en el hotel, si se aplica) Cuidado de niños\
> Accesible para minusválidos
>
> Facilidades en habitaciones\
> Conexión para portátil\
> Aire acondicionado\
> Televisión\
> Televisión por satélite\
> Teléfono directo\
> Mini bar\
> Secador de pelo\
> Voltage 220v\</Observations\>\
> \</rs\>\
> \</smHotelFareType1\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **CancelationPolicy** Politica de Cancelacion que se debe consultar |
| > antes de                                                            |
|                                                                       |
| confirmar la reserva.                                                 |
+-----------------------------------------------------------------------+
| > **LodgingPolicy** Politica de Alojamiento o informacion sobre la    |
| > estadia, se                                                         |
|                                                                       |
| debe mostrar a modo de informacion.                                   |
+-----------------------------------------------------------------------+

> 6.8.3. Observaciones
>
> El response es igual para una tarifa de un presupuesto o reserva.
>
> 6.9. getPackageFare
>
> 6.9.1. Request
>
> \<xsstring6\>\
> \<pos xmlns=\"\"\>\
> \<id\>TESTEO\</id\>\
> \<clave\>TESTEO\</clave\>\
> \</pos\>\
> \<currency\>USD\</currency\>\
> \<budgetid\>00020138206-001\</budgetid\>\
> \<bookingid\>00020138206-001\</bookingid\>\
> \<class\>AEROTERRESTRE\</class\>\
> \<rq\>00020070832\</rq\>\
> \</xsstring6\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **Currency** Codigo ISO de la Moneda                                |
+-----------------------------------------------------------------------+
| > **budgetId** Si es un item de un presupuesto, se debe poner el id   |
| > del                                                                 |
|                                                                       |
| presupuesto y el nro del item, de lo contrario seria nulo.            |
+-----------------------------------------------------------------------+
| > **bookingId** Si es un item de una reserva, se debe poner el id de  |
| > la reserva                                                          |
|                                                                       |
| y el nro del item, de lo contrario seria nulo.                        |
+-----------------------------------------------------------------------+
| > **Class** Clase del Paquete TERRESTRE\                              |
| > AEROTERRESTRE CIRCUITO\                                             |
| > CRUCERO                                                             |
+-----------------------------------------------------------------------+
| > **rq** Id de la Tarifa.                                             |
+-----------------------------------------------------------------------+

> 6.9.2. Response
>
> \<smPackageFareType1
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.wsdl\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<rs
> Class=\"AEROTERRESTRE\"UniqueId=\"00020094503\"BackOfficeCode=\"PMV
> \"\
> BackOfficeOperatorCode=\"00020024555\"xmlns=\"\"\>\
> \<Name
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>PORTOFINO 9
> DIAS CON CONVIASA - SALIDAS SABADOS\</Name\>\
> \<Category
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>TURISTA\</Category\>
> \<Location
> code=\"\"xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"/\>\
> \<OperationItems
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<OperationDay\>sat\</OperationDay\>\
> \</OperationItems\>\
> \<LodgedNights
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>8\</LodgedNights\>
> \<LodgedDays
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>0\</LodgedDays\>\
> \<CancelationPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>Consulte con
> su vendedor.\</CancelationPolicy\>\
> \<LodgingPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>Politica de
> menores: Menores de 02 a 11 años inclusive tomar como chd,
> compartiendo la habitacion con 2 adultos.
>
> Maximo 2 menores compartiendo la habitacion con 2
> adultos.\</LodgingPolicy\>\
> \<ChildPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<Room Type=\"DWL\"MaxNumChild=\"2\"\>\
> \<Child AgeFrom=\"2\"AgeTo=\"12\"MaxNumber=\"2\"FareType=\"CHD\"/\>\
> \</Room\>\
> \</ChildPolicy\>\
> \<Description
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>INCLUYE BOLETO
> AEREO BUE/CCS/PMV/CCS/BUE\
> 8 NOCHES DE ALOJAMIENTO CON TODO INCLUIDO LIMITADO\
> TRASLADOS Y ASISTENCIA TRAVEL ACE\</Description\>\
> \<Details xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"/\>\
> \<Itinerary xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"/\>\
> \<FareList
> currency=\"USD\"xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>
> \<Fare type=\"CHD\"PassengerType=\"CNN\"Availability=\"0\"\>\
> \<Base\>1112.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>1.47\</Tax\>\
> \</Fare\>\
> \<Fare type=\"CPL\"PassengerType=\"ADT\"Availability=\"0\"\>\
> \<Base\>1489.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>
>
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>18.9\</Tax\>\
> \</Fare\>\
> \<Fare type=\"DWL\"PassengerType=\"ADT\"Availability=\"0\"\>\
> \<Base\>1489.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>18.9\</Tax\>\
> \</Fare\>\
> \<Fare type=\"INF\"PassengerType=\"INF\"Availability=\"0\"\>\
> \<Base\>129.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>4\</Tax\>\
> \</Fare\>\
> \<Fare type=\"SGL\"PassengerType=\"ADT\"Availability=\"0\"\>\
> \<Base\>1585.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>23.31\</Tax\>\
> \</Fare\>\
> \<Fare type=\"TPL\"PassengerType=\"ADT\"Availability=\"0\"\>\
> \<Base\>1489.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>18.9\</Tax\>\
> \</Fare\>\
> \</FareList\>\
> \<ValidFrom
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>2012-02-11\</ValidFrom\>
> \<ValidTo
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>2012-02-11\</ValidTo\>
> \<Observations
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>INCLUYE BOLETO
> AEREO BUE/CCS/PMV/CCS/BUE\
> 8 NOCHES DE ALOJAMIENTO CON TODO INCLUIDO LIMITADO\
> TRASLADOS Y ASISTENCIA TRAVEL ACE\</Observations\>\
> \<Pictures type=\"IMG\"\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>www.softur.com.ar/Images/PQT01.jpg\</Pictures
> \>\
> \<Pictures type=\"IMG\"\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>www.softur.com.ar/Images/PQT02.jpg\</Pictures
> \>\
> \<Pictures type=\"IMG\"\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>www.softur.com.ar/Images/PQT03.jpg\</Pictures
> \>\
> \</rs\>\
> \</smPackageFareType1\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **UniqueId** Id de la Tarifa                                        |
+-----------------------------------------------------------------------+
| > **BackOfficeCode** Codigo del Paquete                               |
+-----------------------------------------------------------------------+
| > **BackOfficeOperatorCode** Id del Paquete                           |
+-----------------------------------------------------------------------+
| > **OperationDay** Dias en que opera. Abreviatura a tres caracteres   |
| > de los dias                                                         |
|                                                                       |
| de la semana en ingles.                                               |
+-----------------------------------------------------------------------+

> 6.9.3. Observaciones
>
> 6.10. **[getServiceFare]{.underline}**\
> 6.10.1. Request
>
> \<xsstring1\>\
> \<pos\>\
> \<id\>TESTEO\</id\>\
> \<clave\>TESTEO\</clave\>\
> \</pos\>\
> \<currency\>USD\</currency\>\
> \<budgetid\>00020138206-001\</budgetid\>\
> \<bookingid\>00020138206-001\</bookingid\>\
> \<rq \>00020051319\</rq\>\
> \</xsstring1\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **currency** Codigo ISO de la Moneda.                               |
+-----------------------------------------------------------------------+
| > **budgetid** Si es un item de un presupuesto, se debe poner el id   |
| > del                                                                 |
|                                                                       |
| presupuesto y el nro del item, de lo contrario seria nulo.            |
+-----------------------------------------------------------------------+

+-----------------------------------------------------------------------+
| > **bookingId** Si es un item de una reserva, se debe poner el id de  |
| > la reserva y el nro del item, de lo contrario seria nulo.           |
| >                                                                     |
| > **rq** Id de la Tarifa, FareId                                      |
+=======================================================================+
+-----------------------------------------------------------------------+

+-----------------------------------+-----------------------------------+
| 6.10.2.                           | > Response                        |
+===================================+===================================+
+-----------------------------------+-----------------------------------+

> \<smServiceFareType1
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<rs
> UniqueId=\"00020051319\"BackOfficeCode=\"9890\"BackOfficeOperatorCode=\"10242\"xmlns=\"\"\>
> \<Name\>TRASLADO DESDE AEROPUERTO DE PORTO SEGURO A HOTEL EN ARRAIAL
> DA AJUDA\</Name\> \<Category\>REGULAR\</Category\>\
> \<Location code=\"BPS\"\>PORTO SEGURO\</Location\>\
> \<FareRegulation\>MENORES DE 2 AÑOS CUMPLIDOS EN ADELANTE ABONAN
> TARIFA DE\
> ADULTO\</FareRegulation\>\
> \<FareType\>OW\</FareType\>\
> \<RateType
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>PaxesRate\</RateType\>
> \<CancelationPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"/\>\
> \<LodgingPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"/\>\
> \<FareList currency=\"USD\"\>\
> \<Fare type=\"1-1\"PassengerType=\"ADT\"Availability=\"0\"\>\
> \<Base\>29.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>1.2600\</Tax\>\
> \</Fare\>\
> \<Fare type=\"1-1\"PassengerType=\"CNN\"Availability=\"0\"\>\
> \<Base\>29.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>1.2600\</Tax\>\
> \</Fare\>\
> \<Fare type=\"1-1\"PassengerType=\"INF\"Availability=\"0\"\>\
> \<Base\>0.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>0.0000\</Tax\>\
> \</Fare\>\
> \<Fare type=\"2-10\"PassengerType=\"ADT\"Availability=\"0\"\>\
> \<Base\>14.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>0.5300\</Tax\>\
> \</Fare\>\
> \<Fare type=\"2-10\"PassengerType=\"CNN\"Availability=\"0\"\>\
> \<Base\>14.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>0.5300\</Tax\>\
> \</Fare\>\
> \<Fare type=\"2-10\"PassengerType=\"INF\"Availability=\"0\"\>\
> \<Base\>0.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>0.0000\</Tax\>\
> \</Fare\>\
> \</FareList\>\
> \<ValidFrom\>2010-01-01\</ValidFrom\>\
> \<ValidTo\>2010-12-31\</ValidTo\>\
> \<Observations\>TRASLADO DESDE AEROPUERTO DE PORTO SEGURO A HOTEL EN
> ARRAIAL DA AJUDA EN SERVICIO REGULAR \</Observations\>\
> \</rs\>\
> \</smServiceFareType1\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **currency** Codigo ISO de la Moneda.                               |
+-----------------------------------------------------------------------+
| > **rq** Id de la Tarifa, FareId                                      |
+-----------------------------------------------------------------------+

+-----------------------+-----------------------+-----------------------+
| 6.10.3.               |                       | > Observaciones       |
+=======================+=======================+=======================+
| **6.11.**             | > **[getA             |                       |
|                       | irFare]{.underline}** |                       |
+-----------------------+-----------------------+-----------------------+

> **6.11.1. Request**
>
> \<xsstring3 xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<pos xmlns=\"\"\>
>
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<currency\>USD\</currency\>\
> \<budgetid\>00020138206-001\</budgetid\>
> \<bookingid\>00020138206-001\</bookingid\> \<rq\>00020017205\</rq\>\
> \</xsstring3\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **currency** Codigo ISO de la Moneda.                               |
+-----------------------------------------------------------------------+
| > **budgetid** Si es un item de un presupuesto, se debe poner el id   |
| > del                                                                 |
|                                                                       |
| presupuesto y el nro del item, de lo contrario seria nulo.            |
|                                                                       |
| > **bookingid** Si es un item de una reserva, se debe poner el id de  |
| > la reserva                                                          |
|                                                                       |
| y el nro del item, de lo contrario seria nulo.                        |
|                                                                       |
| > **rq** Id de la Tarifa, FareId                                      |
+-----------------------------------------------------------------------+

> **6.11.2.Response**
>
> \<smAirFareType1
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<rs UniqueId=\"00020017205\"BackOfficeCode=\"I434 \"\
> BackOfficeOperatorCode=\"00629\"xmlns=\"\"\>\
> \<MarketingAirline code=\"OY\"\>ANDES LINEAS AEREAS SA\
> \</MarketingAirline\>\
> \<ResBookDesigCode\>Y1 \</ResBookDesigCode\>\
> \<DepartureAirport code=\"BUE\"\>JORGE NEWBERY\
> \</DepartureAirport\>\
> \<ArrivalAirport code=\"BUE\"\>JORGE NEWBERY \</ArrivalAirport\>
> \<Route\>BUE/BPS/BUE \</Route\>\
> \<FareList currency=\"USD\"\>\
> \<Fare type=\"INF\"PassengerType=\"INF\"Availability=\"0\"\>
> \<Base\>0.0000\</Base\>\
> \<Tax type=\"DNT/QN\"\>0.0000\</Tax\>\
> \<Tax type=\"TASAS\"\>0.0000\</Tax\>\
> \</Fare\>\
> \<Fare type=\"CNN\"PassengerType=\"CNN\"Availability=\"0\"\>
> \<Base\>450.0000\</Base\>\
> \<Tax type=\"DNT/QN\"\>20.0000\</Tax\>\
> \<Tax type=\"TASAS\"\>157.5000\</Tax\>\
> \</Fare\>\
> \<Fare type=\"ADT\"PassengerType=\"ADT\"Availability=\"0\"\>
> \<Base\>450.0000\</Base\>\
> \<Tax type=\"DNT/QN\"\>20.0000\</Tax\>\
> \<Tax type=\"TASAS\"\>157.5000\</Tax\>\
> \</Fare\>\
> \</FareList\>\
> \<ValidFrom\>2010-09-19\</ValidFrom\>\
> \<ValidTo\>2010-12-26\</ValidTo\>\
> \<Observations\>charter andes ventas a una semana\</Observations\>
> \</rs\>\
> \</smAirFareType1\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **currency** Codigo ISO de la Moneda.                               |
+-----------------------------------------------------------------------+
| > **rq** Id de la Tarifa, FareId                                      |
+-----------------------------------------------------------------------+

> **6.11.3.Observaciones**
>
> **6.12. [searchAirFares ]{.underline}**\
> **6.12.1.Request**
>
> \<searchAirFaresRQ1
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<departureLocation code=\"hav\"/\>\
> \<arrivalLocation code=\"ccc\"/\>\
> \<dateFrom\>2010-12-18\</dateFrom\>\
> \<dateTo\>2010-12-18\</dateTo\>\
> \<airline /\>\
> \<pos\>\
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<currency\>USD\</currency\>\
> \</searchAirFaresRQ1\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **airline** Codigo de la aerolinea                                  |
+-----------------------------------------------------------------------+

> **6.12.2.Response**
>
> \<ArrayOfAirFare1
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<AirFares UniqueId=\"00020014979\"BackOfficeCode=\"J264 \"\
> BackOfficeOperatorCode=\"127 \"\>\
> \<MarketingAirline code=\"EC\"\>CUBANACAN AGENCIA DE\
> VIAJES\</MarketingAirline\>\
> \<ResBookDesigCode\>Y\</ResBookDesigCode\>\
> \<DepartureAirport code=\"HAV\"\>JOSE MARTI\</DepartureAirport\>
> \<ArrivalAirport code=\"CCC\"\>CAYO\</ArrivalAirport\>\
> \<Route\>CCC/HAV\</Route\>\
> \<FareList currency=\"USD\"\>\
> \<Fare type=\"CNN\"PassengerType=\"CNN\"Availability=\"0\"\>
> \<Base\>98.7500\</Base\>\
> \<Tax type=\"DNT/QN\"\>0.0000\</Tax\>\
> \<Tax type=\"TASAS\"\>0.0000\</Tax\>\
> \</Fare\>\
> \<Fare type=\"INF\"PassengerType=\"INF\"Availability=\"0\"\>
> \<Base\>0.0000\</Base\>\
> \<Tax type=\"DNT/QN\"\>0.0000\</Tax\>\
> \<Tax type=\"TASAS\"\>0.0000\</Tax\>\
> \</Fare\>\
> \<Fare type=\"ADT\"PassengerType=\"ADT\"Availability=\"0\"\>
> \<Base\>98.7500\</Base\>\
> \<Tax type=\"DNT/QN\"\>0.0000\</Tax\>\
> \<Tax type=\"TASAS\"\>0.0000\</Tax\>\
> \</Fare\>\
> \</FareList\>\
> \<ValidFrom\>2009-12-21\</ValidFrom\>\
> \<ValidTo\>2010-12-31\</ValidTo\>\
> \<Observations /\>\
> \</AirFares\>\
> \<AirFares UniqueId=\"00020017678\"BackOfficeCode=\"J264 \"\
> BackOfficeOperatorCode=\"127 \"\>\
> \<MarketingAirline code=\"EC\"\>CUBANACAN AGENCIA DE VIAJES
> \</MarketingAirline\>
>
> \<ResBookDesigCode\>Y \</ResBookDesigCode\>\
> \<DepartureAirport\>JOSE MARTI \</DepartureAirport\> \<ArrivalAirport
> code=\"CCC\"\>CAYO \</ArrivalAirport\> \<Route\>CCC/HAV \</Route\>\
> \<FareList currency=\"USD\"\>\
> \<Fare type=\"INF\"PassengerType=\"INF\"Availability=\"0\"\>
> \<Base\>0.0000\</Base\>\
> \<Tax type=\"DNT/QN\"\>0.0000\</Tax\>\
> \<Tax type=\"TASAS\"\>0.0000\</Tax\>\
> \</Fare\>\
> \<Fare type=\"CNN\"PassengerType=\"CNN\"Availability=\"0\"\>
> \<Base\>98.7500\</Base\>\
> \<Tax type=\"DNT/QN\"\>0.0000\</Tax\>\
> \<Tax type=\"TASAS\"\>0.0000\</Tax\>\
> \</Fare\>\
> \<Fare type=\"ADT\"PassengerType=\"ADT\"Availability=\"0\"\>
> \<Base\>98.7500\</Base\>\
> \<Tax type=\"DNT/QN\"\>0.0000\</Tax\>\
> \<Tax type=\"TASAS\"\>0.0000\</Tax\>\
> \</Fare\>\
> \</FareList\>\
> \<ValidFrom\>2010-11-01\</ValidFrom\>\
> \<ValidTo\>2011-10-31\</ValidTo\>\
> \<Observations /\>\
> \</AirFares\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \</ArrayOfAirFare1\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **airline** Codigo de la aerolinea                                  |
+-----------------------------------------------------------------------+

> **6.12.3.Observaciones**
>
> **6.13. [searchHotelFares ]{.underline}**\
> **6.13.1.Request**
>
> **Para buscar Tarifas de Hoteles.**
>
> \<searchHotelFaresRQ1\>\
> \<cityLocation code=\"BUE\"/\>\
> \<dateFrom\>2010-09-27\</dateFrom\>\
> \<dateTo\>2010-09-30\</dateTo\>\
> \<name\>HOTEL MELIA\</name\>\
> \<pos\>\
> \<id\>TESTEO\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<currency\>USD\</currency\>\
> \</searchHotelFaresRQ1\>
>
> **Para buscar Tarifa de Hoteles de otros proveedores:**\
> \<searchHotelFaresRQ1\>\
> \<cityLocation code=\"BUE\"/\>\
> \<dateFrom\>2010-09-27\</dateFrom\>\
> \<dateTo\>2010-09-30\</dateTo\>\
> \<name /\>\
> \<pos\>\
> \<id\>TESTEO\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<currency\>USD\</currency\>\
> \<OtherBroker\>true\</OtherBroker\>\
> \<FareTypeSelectionList
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>
> \<FareTypeSelection OccupancyId=\"1\"\>1\</FareTypeSelection\>
>
> \<Ocuppancy OccupancyId=\"1\"\>\
> \<Occupants type=\"ADT\"/\>\
> \<Occupants type=\"ADT\"/\>\
> \<Occupants type=\"ADT\"/\>\
> \</Ocuppancy\>\
> \</FareTypeSelectionList\>\
> \</searchHotelFaresRQ1\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **OtherBroker** Expandir la busqueda a otros brokers registrados    |
+-----------------------------------------------------------------------+

> **6.13.2.Response**\
> **Response de Tarifas de Hoteles**
>
> \<ArrayOfHotelFare1
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.wsdl\"\>\
> \<HotelFares
> UniqueId=\"00000060439\"BackOfficeCode=\"101380\"BackOfficeOperatorCode=\"00976\"
> xmlns=\"\"\>\
> \<Name
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>DIMEO\</Name\>\
> \<Category xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"/\>\
> \<Location
> code=\"BUE\"xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>BUENOS
> AIRES\</Location\>\
> \<RoomFeatures
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>CONSULTAR
> ACLARACIONES TARIFA\</RoomFeatures\>\
> \<CancelationPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>CONSULTAR
> POLITICAS CANCELACION\</CancelationPolicy\>\
> \<LodgingPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>CONSULTAR
> POLITICA DE ALOJAMIENTO y MENORES\
> CONSULTAR ACLARACIONES TARIFA\</LodgingPolicy\>\
> \<ChildPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<Room Type=\"DWL\"MaxNumChild=\"2\"\>\
> \<Child AgeFrom=\"4\"AgeTo=\"10\"MaxNumber=\"2\"FareType=\"CHD\"/\>\
> \</Room\>\
> \</ChildPolicy\>\
> \<RoomType code=\"STD
> CB\"xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>HABITACION
> STANDARD CON DESAYUNO\</RoomType\>\
> \<OperationItems
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<OperationDay\>sun\</OperationDay\>\
> \</OperationItems\>\
> \<OperationItems
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<OperationDay\>mon\</OperationDay\>\
> \</OperationItems\>\
> \<OperationItems
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<OperationDay\>tue\</OperationDay\>\
> \</OperationItems\>\
> \<OperationItems
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<OperationDay\>wed\</OperationDay\>\
> \</OperationItems\>\
> \<OperationItems
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<OperationDay\>thu\</OperationDay\>\
> \</OperationItems\>\
> \<OperationItems
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<OperationDay\>fri\</OperationDay\>\
> \</OperationItems\>\
> \<OperationItems
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<OperationDay\>sat\</OperationDay\>\
> \</OperationItems\>\
> \<HotelAddress
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>TERRERO\
> 934\</HotelAddress\>\
> \<HotelPhone
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>5218-3062\</HotelPhone\>
> \<FareList
> currency=\"USD\"xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<Fare type=\"SGL\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>66.89\</Base\>\
> \<Tax type=\"GRAVADO\"\>14.05\</Tax\>\
> \<Offer\>Oferta de Estancia - Noche(s) Gratis (NO APLICADA)\
> Quédese 4 noches y pague solo 3 noches.
>
> Promoción Acumulable. Se aplicará cada 4 noches\</Offer\>\
> \</Fare\>\
> \<Fare type=\"DWL\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>41.58\</Base\>\
> \<Tax type=\"GRAVADO\"\>8.73\</Tax\>\
> \<Offer\>Oferta de Estancia - Noche(s) Gratis (NO APLICADA) Quédese 4
> noches y pague solo 3 noches.
>
> Promoción Acumulable. Se aplicará cada 4 noches\</Offer\>\
> \</Fare\>\
> \<Fare type=\"TPL\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>32.02\</Base\>\
> \<Tax type=\"GRAVADO\"\>6.72\</Tax\>\
> \<Offer\>Oferta de Estancia - Noche(s) Gratis (NO APLICADA) Quédese 4
> noches y pague solo 3 noches.
>
> Promoción Acumulable. Se aplicará cada 4 noches\</Offer\>
>
> \</Fare\>\
> \<Fare type=\"CHD\"PassengerType=\"CNN\"Availability=\"2\"\>\
> \<Base\>0.00\</Base\>\
> \<Tax type=\"GRAVADO\"\>0.00\</Tax\>\
> \<Offer\>Oferta de Estancia - Noche(s) Gratis (NO APLICADA) Quédese 4
> noches y pague solo 3 noches.
>
> Promoción Acumulable. Se aplicará cada 4 noches\</Offer\>\
> \</Fare\>\
> \<Fare type=\"CH2\"PassengerType=\"CNN\"Availability=\"2\"\>\
> \<Base\>0.00\</Base\>\
> \<Tax type=\"GRAVADO\"\>0.00\</Tax\>\
> \<Offer\>Oferta de Estancia - Noche(s) Gratis (NO APLICADA) Quédese 4
> noches y pague solo 3 noches.
>
> Promoción Acumulable. Se aplicará cada 4 noches\</Offer\>\
> \</Fare\>\
> \<Fare type=\"CH3\"PassengerType=\"CNN\"Availability=\"2\"\>\
> \<Base\>0.00\</Base\>\
> \<Tax type=\"GRAVADO\"\>0.00\</Tax\>\
> \<Offer\>Oferta de Estancia - Noche(s) Gratis (NO APLICADA) Quédese 4
> noches y pague solo 3 noches.
>
> Promoción Acumulable. Se aplicará cada 4 noches\</Offer\>\
> \</Fare\>\
> \<Fare type=\"INF\"PassengerType=\"INF\"Availability=\"2\"\>\
> \<Base\>0.00\</Base\>\
> \<Tax type=\"GRAVADO\"\>0.00\</Tax\>\
> \<Offer\>Oferta de Estancia - Noche(s) Gratis (NO APLICADA) Quédese 4
> noches y pague solo 3 noches.
>
> Promoción Acumulable. Se aplicará cada 4 noches\</Offer\>\
> \</Fare\>\
> \</FareList\>\
> \<ValidFrom
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>2011-12-28\</ValidFrom\>
> \<ValidTo
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>2012-03-15\</ValidTo\>
> \<Observations
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>CONSULTAR
> POLITICA DE ALOJAMIENTO y MENORES\
> CONSULTAR ACLARACIONES TARIFA\</Observations\>\
> \</HotelFares\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \</ArrayOfHotelFare1\>
>
> **Response de Tarifas de Hoteles de otros proveedores.**
>
> \<ArrayOfHotelFare1
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.wsdl\"\>\
> \<HotelFares UniqueId=\"GT\|BUE-NOG-H\"BackOfficeCode=\"BUE-NOG-H\"\
> BackOfficeOperatorCode=\"00068 \"xmlns=\"\"\>\
> \<Name xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>562
> NOGARO\</Name\>\
> \<Category\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>4\*\</Category\>\
> \<Location code=\"BUE\"\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>Buenos
> Aires\</Location\>\
> \<RoomFeatures\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>Break
> Fast:Buffet caliente\</RoomFeatures\> \<CancelationPolicy\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"/\>\
> \<LodgingPolicy xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"
> /\>\
> \<HotelAddress\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>AVENIDA JULIO
> A. ROCA 562,BUENOS\
> AIRES,A\</HotelAddress\>\
> \<HotelPhone\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>54-11-43310091\</HotelPhone\>\
> \<Pictures type=\"web\"\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>www.hotelnogaro.com\</Pictures\>\
> \<FareList currency=\"USD\"\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<Fare type=\"SGL\"PassengerType=\"ADT\"Availability=\"3\"
> FareIdBroker=\"GT\|BUE-NOG-H\|TR\|001:NOG\"OccupancyId=\"1\"\>\
> \<Base\>472.50\</Base\>\
> \<Tax type=\"GRAVADO\"\>19.84\</Tax\>\
> \<Description\>triple Estándar /Desayuno\
> incluido\</Description\>\
> \</Fare\>\
> \<Fare type=\"SGL\"PassengerType=\"ADT\"Availability=\"3\"
> FareIdBroker=\"GT\|BUE-NOG-H\|TR\|001:NOG2\"OccupancyId=\"1\"\>\
> \<Base\>590.62\</Base\>\
> \<Tax type=\"GRAVADO\"\>24.81\</Tax\>\
> \<Description\>triple Executive /Desayuno\
> incluido\</Description\>\
> \</Fare\>\
> \<Ocuppancy OccupancyId=\"1\"\>
>
> \<Occupants type=\"ADT\"/\>\
> \<Occupants type=\"ADT\"/\>\
> \<Occupants type=\"ADT\"/\>\
> \</Ocuppancy\>\
> \</FareList\>\
> \<ValidFrom\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>2010-09-27\</ValidFrom\>\
> \<ValidTo
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>2010-09-30\</ValidTo\>\
> \<Observations xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"
> /\>\
> \</HotelFares\>\
> \<HotelFares UniqueId=\"GT\|BUE-AME5-H\"BackOfficeCode=\"BUE-AME5-H\"\
> BackOfficeOperatorCode=\"00068 \"xmlns=\"\"\>\
> \<Name xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>AMERIAN
> PARK\</Name\>\
> \<Category\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>4\*\</Category\>\
> \<Location code=\"BUE\"\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>Buenos
> Aires\</Location\>\
> \<RoomFeatures\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>Break
> Fast:Buffet caliente\</RoomFeatures\> \<CancelationPolicy\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"/\>\
> \<LodgingPolicy xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"
> /\>\
> \<HotelAddress\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>RECONQUISTA
> 699,BUENOS\
> AIRES,ARGENTINA,\</HotelAddress\>\
> \<HotelPhone\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>54-11-51716500\</HotelPhone\>\
> \<Pictures type=\"web\"\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>www.amerian.com\</Pictures\>\
> \<FareList currency=\"USD\"\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<Fare type=\"SGL\"PassengerType=\"ADT\"Availability=\"2\"
> FareIdBroker=\"GT\|BUE-AME5-H\|TR\|001:AME8\"OccupancyId=\"1\"\>\
> \<Base\>601.88\</Base\>\
> \<Tax type=\"GRAVADO\"\>25.28\</Tax\>\
> \<Description\>triple Run of House /Desayuno incluido\</Description\>\
> \</Fare\>\
> \<Fare type=\"SGL\"PassengerType=\"ADT\"Availability=\"3\"
> FareIdBroker=\"GT\|BUE-AME5-H\|TR\|001:AME5\"OccupancyId=\"1\"\>\
> \<Base\>877.50\</Base\>\
> \<Tax type=\"GRAVADO\"\>36.86\</Tax\>\
> \<Description\>triple Estándar /Desayuno\
> incluido\</Description\>\
> \</Fare\>\
> \<Ocuppancy OccupancyId=\"1\"\>\
> \<Occupants type=\"ADT\"/\>\
> \<Occupants type=\"ADT\"/\>\
> \<Occupants type=\"ADT\"/\>\
> \</Ocuppancy\>\
> \</FareList\>\
> \<ValidFrom\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>2010-09-27\</ValidFrom\>\
> \<ValidTo
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>2010-09-30\</ValidTo\>\
> \<Observations xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"
> /\>\
> \</HotelFares\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto\>MK: We dont have prices for this criteria.\</texto\>\
> \</resultado\>\
> \</ArrayOfHotelFare1\>

+-----------------------------------------------------------------------+
| +--------------------------------+--------------------------------+   |
| |   ---------------------------  |   ---------------------------  |   |
| |   **Campo**                    |   **Descripcion**              |   |
| |   ---------------------------  |   ---------------------------  |   |
| |                                |                                |   |
| |   ---------------------------  |   ---------------------------  |   |
| +================================+================================+   |
| +--------------------------------+--------------------------------+   |
+=======================================================================+
| > **Availability** Disponibilidad\                                    |
| > 1 -- No Disponible\                                                 |
| > 2 -- A Requerir\                                                    |
| > 3 -- Con cupo disponibles para la confirmacion inmediata            |
+-----------------------------------------------------------------------+
| > **Occupancy** Ocupacion que debe ser enviada en el makeBudget.      |
+-----------------------------------------------------------------------+
| > **FareIdBroker** Id de la tarifa del broker.                        |
+-----------------------------------------------------------------------+

> **6.13.3.Observaciones**
>
> **6.14. [searchPackageFares ]{.underline}**\
> **6.14.1.Request**
>
> \<searchPackageFaresRQ1\>\
> \<Class\>AEROTERRESTRE\</Class\>\
> \<cityLocation code=\"PMV\"/\>\
> \<dateFrom\>2012-01-07\</dateFrom\>\
> \<dateTo\>2012-01-14\</dateTo\>\
> \<name /\>\
> \<keyword /\>\
> \<pos\>\
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<currency\>USD\</currency\>\
> \</searchPackageFaresRQ1\>
>
> **6.14.2.Response**
>
> \<ArrayOfPackageFare1\>\
> \<PackageFares
> Class=\"AEROTERRESTRE\"UniqueId=\"00020094501\"BackOfficeCode=\"PMV \"
> BackOfficeOperatorCode=\"00020024555\"xmlns=\"\"\>\
> \<Name\>PORTOFINO 9 DIAS CON CONVIASA - SALIDAS SABADOS\</Name\>\
> \<Category\>TURISTA\</Category\>\
> \<Location code=\"\"/\>\
> \<OperationItems\>\
> \<OperationDay\>sat\</OperationDay\>\
> \</OperationItems\>\
> \<LodgedNights\>8\</LodgedNights\>\
> \<LodgedDays\>0\</LodgedDays\>\
> \<CancelationPolicy\>Consulte con su vendedor.\</CancelationPolicy\>\
> \<LodgingPolicy\>Politica de menores: Menores de 02 a 11 años
> inclusive tomar como chd, compartiendo la habitacion con 2 adultos.
>
> Maximo 2 menores compartiendo la habitacion con 2
> adultos.\</LodgingPolicy\> \<ChildPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<Room Type=\"DWL\"MaxNumChild=\"2\"\>\
> \<Child AgeFrom=\"2\"AgeTo=\"12\"FareType=\"CHD\"/\>\
> \</Room\>\
> \</ChildPolicy\>\
> \<Description\>INCLUYE BOLETO AEREO BUE/CCS/PMV/CCS/BUE\
> 8 NOCHES DE ALOJAMIENTO CON TODO INCLUIDO LIMITADO\
> TRASLADOS Y ASISTENCIA TRAVEL ACE\</Description\>\
> \<Details /\>\
> \<Itinerary /\>\
> \<FareList currency=\"USD\"\>\
> \<Fare type=\"CHD\"PassengerType=\"CNN\"Availability=\"2\"\>\
> \<Base\>1112.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>1.47\</Tax\>\
> \</Fare\>\
> \<Fare type=\"CPL\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>1471.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>18.06\</Tax\>\
> \</Fare\>\
> \<Fare type=\"DWL\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>1471.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>18.06\</Tax\>\
> \</Fare\>\
> \<Fare type=\"INF\"PassengerType=\"INF\"Availability=\"2\"\>\
> \<Base\>129.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>4\</Tax\>\
> \</Fare\>\
> \<Fare type=\"SGL\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>1565.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>22.47\</Tax\>\
> \</Fare\>\
> \<Fare type=\"TPL\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>1471.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>
>
> \<Tax type=\"GRAVADO\"\>18.06\</Tax\>\
> \</Fare\>\
> \</FareList\>\
> \<OperationDays\>\
> \<OperationDay
> Date=\"2012-01-07\"SeatAvailable=\"20\"RoomsAvailable=\"0\"\>
> \<Composition\>\
> \<Hotel ItemId=\"020\"Checkin=\"2012-01-07\"Checkout=\"2012-01-15\"\>
> \<Code\>000123\</Code\>\
> \<Name\>PORTOFINO COMPLEX\</Name\>\
> \<Category\>3\*\</Category\>\
> \<Location code=\"PMV\"\>ISLA MARGARITA\</Location\>\
> \<RoomType code=\"STD-AI\"\>STANDARD ALL INCLUSIVE\</RoomType\>
> \<RoomsAvailable\>0\</RoomsAvailable\>\
> \</Hotel\>\
> \<Air ItemId=\"011\"DepartureDay=\"2012-01-07\"\>\
> \<Airline\>\
> \<Code\>015405\</Code\>\
> \<IATA\>V0\</IATA\>\
> \<Name\>CONVIASA\</Name\>\
> \</Airline\>\
> \<Flight\>\
> \<Number\>2008\</Number\>\
> \<Category\>Y\</Category\>\
> \<SeatAvailable\>20\</SeatAvailable\>\
> \</Flight\>\
> \<Departure\>\
> \<Time\>14:30\</Time\>\
> \<City Code=\"CCS\"\>CARACAS\</City\>\
> \<Airport Code=\"CCS\"\>SIMON BOLIVAR INT\'L\</Airport\>
> \</Departure\>\
> \<Arrival\>\
> \<Time\>15:20\</Time\>\
> \<City Code=\"PMV\"\>ISLA MARGARITA\</City\>\
> \<Airport Code=\"PMV\"\>GRAL.SANTIAGO MARINO\</Airport\> \</Arrival\>\
> \</Air\>\
> \<Air ItemId=\"011\"DepartureDay=\"2012-01-15\"\>\
> \<Airline\>\
> \<Code\>015405\</Code\>\
> \<IATA\>V0\</IATA\>\
> \<Name\>CONVIASA\</Name\>\
> \</Airline\>\
> \<Flight\>\
> \<Number\>2005\</Number\>\
> \<Category\>Y\</Category\>\
> \<SeatAvailable\>20\</SeatAvailable\>\
> \</Flight\>\
> \<Departure\>\
> \<Time\>12:10\</Time\>\
> \<City Code=\"PMV\"\>ISLA MARGARITA\</City\>\
> \<Airport Code=\"PMV\"\>GRAL.SANTIAGO MARINO\</Airport\>
> \</Departure\>\
> \<Arrival\>\
> \<Time\>13:00\</Time\>\
> \<City Code=\"CCS\"\>CARACAS\</City\>\
> \<Airport Code=\"CCS\"\>SIMON BOLIVAR INT\'L\</Airport\> \</Arrival\>\
> \</Air\>\
> \<Air ItemId=\"011\"DepartureDay=\"2012-01-15\"\>\
> \<Airline\>\
> \<Code\>015405\</Code\>\
> \<IATA\>V0\</IATA\>\
> \<Name\>CONVIASA\</Name\>\
> \</Airline\>\
> \<Flight\>\
> \<Number\>5000\</Number\>\
> \<Category\>Y\</Category\>\
> \<SeatAvailable\>20\</SeatAvailable\>\
> \</Flight\>\
> \<Departure\>\
> \<Time\>18:00\</Time\>\
> \<City Code=\"CCS\"\>CARACAS\</City\>\
> \<Airport Code=\"CCS\"\>SIMON BOLIVAR INT\'L\</Airport\>
> \</Departure\>\
> \<Arrival\>\
> \<Time\>02:30\</Time\>\
> \<City Code=\"BUE\"\>BUENOS AIRES\</City\>\
> \<Airport Code=\"EZE\"\>MINIST. PISTARINI\</Airport\>\
> \</Arrival\>\
> \</Air\>\
> \<Transport ItemId=\"009\"DepartureDay=\"2012-01-09\"\>\
> \<Supplier\>\
> \<Code\>000234\</Code\>
>
> \<Name\>ELADIA ISABEL\</Name\>\
> \</Supplier\>\
> \<Travel\>\
> \<Number\>00081\</Number\>\
> \<Detail\>BUE/COL/BUE + BUS MVD - ELADIA ISAB\</Detail\>
> \<Category\>TURISTA OPERADOR\</Category\>\
> \<SeatAvailable\>40\</SeatAvailable\>\
> \</Travel\>\
> \<Departure\>\
> \<Time\>04:30\</Time\>\
> \<City Code=\"COL\"\>COLONIA\</City\>\
> \<Place Code=\"PCO\"\>PUERTO DE COLONIA\</Place\>\
> \</Departure\>\
> \<Arrival\>\
> \<Time\>07:30\</Time\>\
> \<City Code=\"BUE\"\>BUENOS AIRES\</City\>\
> \<Place Code=\"PDN\"\>PUERTO DNA. NORTE\</Place\>\
> \</Arrival\>\
> \</Transport\>\
> \</Composition\>\
> \</OperationDay\>\
> \</OperationDays\>\
> \<ValidFrom\>2012-01-07\</ValidFrom\>\
> \<ValidTo\>2012-01-14\</ValidTo\>\
> \<Observations\>INCLUYE BOLETO AEREO BUE/CCS/PMV/CCS/BUE\
> 8 NOCHES DE ALOJAMIENTO CON TODO INCLUIDO LIMITADO\
> TRASLADOS Y ASISTENCIA TRAVEL ACE\</Observations\>\
> \<Pictures
> type=\"IMG\"\>www.softur.com.ar/Images/PQT01.jpg\</Pictures\>
> \<Pictures
> type=\"IMG\"\>www.softur.com.ar/Images/PQT02.jpg\</Pictures\>
> \<Pictures
> type=\"IMG\"\>www.softur.com.ar/Images/PQT03.jpg\</Pictures\>
> \</PackageFares\>\
> \</ArrayOfPackageFare1\>\
> **6.14.3.Observaciones**
>
> Existen dos tipos de búsquedas de paquetes: Por Ciudad o por UniqueId.
> Para el caso de la búsqueda por Ciudad, se devuelve la disponibilidad
> y la composición para la primera salida solamente, según los días de
> Salida del Paquete. Dentro de la Composición se enumera los Hoteles y
> Aereos con sus segmentos, con la fecha según la programación del
> paquete.
>
> Para el caso de la búsqueda por id, se devuelven todas las salidas de
> esa tarifa según la Vigencia y la fecha DateFrom -- DateTo
> especificada.\
> Ej.
>
> \<searchPackageFaresRQ1\>\
> \<Class\>AEROTERRESTRE\</Class\>\
> \<cityLocation code=\"PMV\"/\>\
> \<dateFrom\>2012-01-07\</dateFrom\>\
> \<dateTo\>2012-01-14\</dateTo\>\
> \<name /\>\
> \<keyword /\>\
> \<pos\>\
> \<id\>WSDESPE\</id\>\
> \<clave\>WSD001\</clave\>\
> \</pos\>\
> \<currency\>USD\</currency\>\
> \<budgetid\>00020094501\</budgetid\>\
> \</searchPackageFaresRQ1\>
>
> \<ArrayOfPackageFare1\>\
> \<PackageFares
> Class=\"AEROTERRESTRE\"UniqueId=\"00020094501\"BackOfficeCode=\"PMV \"
> BackOfficeOperatorCode=\"00020024555\"xmlns=\"\"\>\
> \<Name\>PORTOFINO 9 DIAS CON CONVIASA - SALIDAS SABADOS\</Name\>\
> \<Category\>TURISTA\</Category\>\
> \<Location code=\"\"/\>\
> \<OperationItems\>\
> \<OperationDay\>sat\</OperationDay\>\
> \</OperationItems\>\
> \<LodgedNights\>8\</LodgedNights\>\
> \<LodgedDays\>0\</LodgedDays\>\
> \<CancelationPolicy\>Consulte con su vendedor.\</CancelationPolicy\>\
> \<LodgingPolicy\>Politica de menores: Menores de 02 a 11 años
> inclusive tomar como chd, compartiendo la habitacion con 2 adultos.
>
> Maximo 2 menores compartiendo la habitacion con 2
> adultos.\</LodgingPolicy\> \<ChildPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>\
> \<Room Type=\"DWL\"MaxNumChild=\"2\"\>\
> \<Child AgeFrom=\"2\"AgeTo=\"12\"FareType=\"CHD\"/\>\
> \</Room\>\
> \</ChildPolicy\>\
> \<Description\>INCLUYE BOLETO AEREO BUE/CCS/PMV/CCS/BUE\
> 8 NOCHES DE ALOJAMIENTO CON TODO INCLUIDO LIMITADO\
> TRASLADOS Y ASISTENCIA TRAVEL ACE\</Description\>\
> \<Details /\>\
> \<Itinerary /\>\
> \<FareList currency=\"USD\"\>\
> \<Fare type=\"CHD\"PassengerType=\"CNN\"Availability=\"2\"\>\
> \<Base\>1112.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>1.47\</Tax\>\
> \</Fare\>\
> \<Fare type=\"CPL\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>1471.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>18.06\</Tax\>\
> \</Fare\>\
> \<Fare type=\"DWL\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>1471.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>18.06\</Tax\>\
> \</Fare\>\
> \<Fare type=\"INF\"PassengerType=\"INF\"Availability=\"2\"\>\
> \<Base\>129.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>4\</Tax\>\
> \</Fare\>\
> \<Fare type=\"SGL\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>1565.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>22.47\</Tax\>\
> \</Fare\>\
> \<Fare type=\"TPL\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>1471.0000\</Base\>\
> \<Tax type=\"DNT/QN/Imp.1\"\>45\</Tax\>\
> \<Tax type=\"TAX/No.Comis.\"\>232\</Tax\>\
> \<Tax type=\"GRAVADO\"\>18.06\</Tax\>\
> \</Fare\>\
> \</FareList\>\
> \<OperationDays\>\
> \<OperationDay
> Date=\"2012-01-07\"SeatAvailable=\"20\"RoomsAvailable=\"0\"\>
> \<Composition\>\
> \<Hotel ItemId=\"020\"Checkin=\"2012-01-07\"Checkout=\"2012-01-15\"\>
> \<Code\>000123\</Code\>\
> \<Name\>PORTOFINO COMPLEX\</Name\>\
> \<Category\>3\*\</Category\>\
> \<Location code=\"PMV\"\>ISLA MARGARITA\</Location\>\
> \<RoomType code=\"STD-AI\"\>STANDARD ALL INCLUSIVE\</RoomType\>
> \<RoomsAvailable\>0\</RoomsAvailable\>\
> \</Hotel\>\
> \<Air ItemId=\"011\"Departure=\"2012-01-07\"\>\
> \<Airline\>\
> \<Code\>015405\</Code\>\
> \<IATA\>V0\</IATA\>\
> \<Name\>CONVIASA\</Name\>\
> \</Airline\>\
> \<Flight\>\
> \<Number\>2008\</Number\>\
> \<Category\>Y\</Category\>\
> \<SeatAvailable\>20\</SeatAvailable\>\
> \</Flight\>\
> \<Departure\>
>
> \<Time\>14:30\</Time\>\
> \<City Code=\"CCS\"\>CARACAS\</City\>\
> \<Airport Code=\"CCS\"\>SIMON BOLIVAR INT\'L\</Airport\>
> \</Departure\>\
> \<Arrival\>\
> \<Time\>15:20\</Time\>\
> \<City Code=\"PMV\"\>ISLA MARGARITA\</City\>\
> \<Airport Code=\"PMV\"\>GRAL.SANTIAGO MARINO\</Airport\> \</Arrival\>\
> \</Air\>\
> \<Air ItemId=\"011\"Departure=\"2012-01-15\"\>\
> \<Airline\>\
> \<Code\>015405\</Code\>\
> \<IATA\>V0\</IATA\>\
> \<Name\>CONVIASA\</Name\>\
> \</Airline\>\
> \<Flight\>\
> \<Number\>2005\</Number\>\
> \<Category\>Y\</Category\>\
> \<SeatAvailable\>20\</SeatAvailable\>\
> \</Flight\>\
> \<Departure\>\
> \<Time\>12:10\</Time\>\
> \<City Code=\"PMV\"\>ISLA MARGARITA\</City\>\
> \<Airport Code=\"PMV\"\>GRAL.SANTIAGO MARINO\</Airport\>
> \</Departure\>\
> \<Arrival\>\
> \<Time\>13:00\</Time\>\
> \<City Code=\"CCS\"\>CARACAS\</City\>\
> \<Airport Code=\"CCS\"\>SIMON BOLIVAR INT\'L\</Airport\> \</Arrival\>\
> \</Air\>\
> \<Air ItemId=\"011\"Departure=\"2012-01-15\"\>\
> \<Airline\>\
> \<Code\>015405\</Code\>\
> \<IATA\>V0\</IATA\>\
> \<Name\>CONVIASA\</Name\>\
> \</Airline\>\
> \<Flight\>\
> \<Number\>5000\</Number\>\
> \<Category\>Y\</Category\>\
> \<SeatAvailable\>20\</SeatAvailable\>\
> \</Flight\>\
> \<Departure\>\
> \<Time\>18:00\</Time\>\
> \<City Code=\"CCS\"\>CARACAS\</City\>\
> \<Airport Code=\"CCS\"\>SIMON BOLIVAR INT\'L\</Airport\>
> \</Departure\>\
> \<Arrival\>\
> \<Time\>02:30\</Time\>\
> \<City Code=\"BUE\"\>BUENOS AIRES\</City\>\
> \<Airport Code=\"EZE\"\>MINIST. PISTARINI\</Airport\>\
> \</Arrival\>\
> \</Air\>\
> \</Composition\>\
> \</OperationDay\>\
> \<OperationDay
> Date=\"2012-01-14\"SeatAvailable=\"20\"RoomsAvailable=\"0\"\>
> \<Composition\>\
> \<Hotel ItemId=\"020\"Checkin=\"2012-01-14\"Checkout=\"2012-01-22\"\>
> \<Code\>000123\</Code\>\
> \<Name\>PORTOFINO COMPLEX\</Name\>\
> \<Category\>3\*\</Category\>\
> \<Location code=\"PMV\"\>ISLA MARGARITA\</Location\>\
> \<RoomType code=\"STD-AI\"\>STANDARD ALL INCLUSIVE\</RoomType\>
> \<RoomsAvailable\>0\</RoomsAvailable\>\
> \</Hotel\>\
> \<Air ItemId=\"011\"Departure=\"2012-01-14\"\>\
> \<Airline\>\
> \<Code\>015405\</Code\>\
> \<IATA\>V0\</IATA\>\
> \<Name\>CONVIASA\</Name\>\
> \</Airline\>\
> \<Flight\>\
> \<Number\>2008\</Number\>\
> \<Category\>Y\</Category\>\
> \<SeatAvailable\>20\</SeatAvailable\>\
> \</Flight\>\
> \<Departure\>\
> \<Time\>14:30\</Time\>\
> \<City Code=\"CCS\"\>CARACAS\</City\>\
> \<Airport Code=\"CCS\"\>SIMON BOLIVAR INT\'L\</Airport\>
> \</Departure\>\
> \<Arrival\>
>
> \<Time\>15:20\</Time\>\
> \<City Code=\"PMV\"\>ISLA MARGARITA\</City\>\
> \<Airport Code=\"PMV\"\>GRAL.SANTIAGO MARINO\</Airport\> \</Arrival\>\
> \</Air\>\
> \<Air ItemId=\"011\"Departure=\"2012-01-22\"\>\
> \<Airline\>\
> \<Code\>015405\</Code\>\
> \<IATA\>V0\</IATA\>\
> \<Name\>CONVIASA\</Name\>\
> \</Airline\>\
> \<Flight\>\
> \<Number\>2005\</Number\>\
> \<Category\>Y\</Category\>\
> \<SeatAvailable\>20\</SeatAvailable\>\
> \</Flight\>\
> \<Departure\>\
> \<Time\>12:10\</Time\>\
> \<City Code=\"PMV\"\>ISLA MARGARITA\</City\>\
> \<Airport Code=\"PMV\"\>GRAL.SANTIAGO MARINO\</Airport\>
> \</Departure\>\
> \<Arrival\>\
> \<Time\>13:00\</Time\>\
> \<City Code=\"CCS\"\>CARACAS\</City\>\
> \<Airport Code=\"CCS\"\>SIMON BOLIVAR INT\'L\</Airport\> \</Arrival\>\
> \</Air\>\
> \<Air ItemId=\"011\"Departure=\"2012-01-22\"\>\
> \<Airline\>\
> \<Code\>015405\</Code\>\
> \<IATA\>V0\</IATA\>\
> \<Name\>CONVIASA\</Name\>\
> \</Airline\>\
> \<Flight\>\
> \<Number\>5000\</Number\>\
> \<Category\>Y\</Category\>\
> \<SeatAvailable\>20\</SeatAvailable\>\
> \</Flight\>\
> \<Departure\>\
> \<Time\>18:00\</Time\>\
> \<City Code=\"CCS\"\>CARACAS\</City\>\
> \<Airport Code=\"CCS\"\>SIMON BOLIVAR INT\'L\</Airport\>
> \</Departure\>\
> \<Arrival\>\
> \<Time\>02:30\</Time\>\
> \<City Code=\"BUE\"\>BUENOS AIRES\</City\>\
> \<Airport Code=\"EZE\"\>MINIST. PISTARINI\</Airport\> \</Arrival\>\
> \</Air\>\
> \</Composition\>\
> \</OperationDay\>\
> \</OperationDays\>\
> \<ValidFrom\>2012-01-07\</ValidFrom\>\
> \<ValidTo\>2012-01-14\</ValidTo\>\
> \<Observations\>INCLUYE BOLETO AEREO BUE/CCS/PMV/CCS/BUE\
> 8 NOCHES DE ALOJAMIENTO CON TODO INCLUIDO LIMITADO\
> TRASLADOS Y ASISTENCIA TRAVEL ACE\</Observations\>\
> \<Pictures
> type=\"IMG\"\>www.softur.com.ar/Images/PQT01.jpg\</Pictures\>
> \<Pictures
> type=\"IMG\"\>www.softur.com.ar/Images/PQT02.jpg\</Pictures\>
> \<Pictures
> type=\"IMG\"\>www.softur.com.ar/Images/PQT03.jpg\</Pictures\>
> \</PackageFares\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \</ArrayOfPackageFare1\>
>
> **6.15. [searchServiceFares ]{.underline}**\
> **6.15.1.Request**
>
> \<searchServiceFaresRQ1
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<cityLocation code=\"BZS\"xmlns=\"\"/\>\
> \<dateFrom xmlns=\"\"\>2010-10-10\</dateFrom\>\
> \<dateTo xmlns=\"\"\>2010-10-10\</dateTo\>\
> \<name xmlns=\"\"/\>\
> \<type xmlns=\"\"\>1\</type\>\
> \<pos xmlns=\"\"\>\
> \<id\>testeo\</id\>\
> \<clave\>testeo\</clave\>\
> \</pos\>\
> \<currency xmlns=\"\"\>USD\</currency\>\
> \</searchServiceFaresRQ1\>
>
> **6.15.2.Response**
>
> \<ArrayOfServiceFare1
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.wsdl\"\>\
> \<ServiceFares
> UniqueId=\"00020064516\"BackOfficeCode=\"G882\"BackOfficeOperatorCode=\"10199\"
> xmlns=\"\"\>\
> \<Name
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>TRANSFER DESDE
> HOTEL BUZIOS A HOTEL EN RIO (COPACABANA - IPANEMA - LEBLON).\</Name\>\
> \<Category
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>REGULAR\</Category\>
> \<CategoryDescription
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>REGULAR. DATOS
> ADICIONALES\...\</CategoryDescription\>\
> \<Location code=\"BZS\"\
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>BUZIOS\</Location\>\
> \<FareRegulation
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"/\>\
> \<FareType
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>OW\</FareType\>\
> \<RateType
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>PaxesRate\</RateType\>
> \<CancelationPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"/\>\
> \<LodgingPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"/\>\
> \<FareList
> currency=\"USD\"xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>\
> \<Fare type=\"1-1\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>45.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>1.8900\</Tax\>\
> \</Fare\>\
> \<Fare type=\"1-1\"PassengerType=\"CNN\"Availability=\"2\"\>\
> \<Base\>45.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>1.8900\</Tax\>\
> \</Fare\>\
> \<Fare type=\"1-1\"PassengerType=\"INF\"Availability=\"2\"\>\
> \<Base\>0.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>0.0000\</Tax\>\
> \</Fare\>\
> \<Fare type=\"2-20\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>23.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>1.0500\</Tax\>\
> \</Fare\>\
> \<Fare type=\"2-20\"PassengerType=\"CNN\"Availability=\"2\"\>\
> \<Base\>23.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>1.0500\</Tax\>\
> \</Fare\>\
> \<Fare type=\"2-20\"PassengerType=\"INF\"Availability=\"2\"\>\
> \<Base\>0.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>0.0000\</Tax\>\
> \</Fare\>\
> \</FareList\>\
> \<ValidFrom
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>2010-01-01\</ValidFrom\>
> \<ValidTo
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>2010-12-31\</ValidTo\>
> \<Observations
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>TRASLADO
> INTERHOTEL DESDE BUZIOS A RIO DE JANEIRO (COPACABANA, IPANEMA, LEBLON)
> EN SERVICIO REGULAR.\</Observations\> \</ServiceFares\>\
> \<ServiceFares
> UniqueId=\"00020064514\"BackOfficeCode=\"G830\"BackOfficeOperatorCode=\"10199\"
> xmlns=\"\"\>\
> \<Name
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>TRANSFER DESDE
> HOTEL BUZIOS AL AEROPUERTO DE RIO.\</Name\>\
> \<Category
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>REGULAR
> \</Category\> \<Location
> code=\"BZS\"xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>BUZIOS
> \</Location\>
>
> \<FareRegulation
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"/\>\
> \<FareType
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>OW\</FareType\>\
> \<RateType
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>PaxesRate\</RateType\>
> \<CancelationPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"/\>\
> \<LodgingPolicy
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"/\>\
> \<FareList
> currency=\"USD\"xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>\
> \<Fare type=\"1-1\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>45.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>1.8900\</Tax\>\
> \</Fare\>\
> \<Fare type=\"1-1\"PassengerType=\"CNN\"Availability=\"2\"\>\
> \<Base\>45.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>1.8900\</Tax\>\
> \</Fare\>\
> \<Fare type=\"1-1\"PassengerType=\"INF\"Availability=\"2\"\>\
> \<Base\>0.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>0.0000\</Tax\>\
> \</Fare\>\
> \<Fare type=\"2-20\"PassengerType=\"ADT\"Availability=\"2\"\>\
> \<Base\>23.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>1.0500\</Tax\>\
> \</Fare\>\
> \<Fare type=\"2-20\"PassengerType=\"CNN\"Availability=\"2\"\>\
> \<Base\>23.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>1.0500\</Tax\>\
> \</Fare\>\
> \<Fare type=\"2-20\"PassengerType=\"INF\"Availability=\"2\"\>\
> \<Base\>0.0000\</Base\>\
> \<Tax type=\"GRAVADO\"\>0.0000\</Tax\>\
> \</Fare\>\
> \</FareList\>\
> \<ValidFrom
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>2010-01-01\</ValidFrom\>
> \<ValidTo
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>2010-12-31\</ValidTo\>
> \<Observations
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.xsd\"\>TRASLADO DE
> HOTEL EN BUZIOS A AEROPUERTO DE RIO DE JANEIRO EN SERVICIO
> REGULAR\</Observations\>\
> \</ServiceFares\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \</ArrayOfServiceFare1\>
>
> **6.15.3.Observaciones**
>
> **6.16. [addEvent ]{.underline}**\
> **6.16.1.Request**
>
> \<AddEventRQ
> xmlns:xsi=\"[http://www.w3.org/2001/XMLSchema-instance]{.underline}\"\
> xmlns:xsd=\"[http://www.w3.org/2001/XMLSchema]{.underline}\"\>\
> \<pos\>\
> \<id\>TESTEO\</id\>\
> \<clave\>TESTEO\</clave\>\
> \</pos\>\
> \<rq\>\
> \<EventBudget Type=\"CRUCERO\"\>\
> \<FareId
> xmlns=\"[http://www.softur.com.ar/wsbridge/budget.xsd]{.underline}\"/\>
> \<Description\
> xmlns=\"[http://www.softur.com.ar/wsbridge/budget.xsd]{.underline}\"\>CRUCERO
> AL\
> DELTA\</Description\>\
> \<InDate\
> xmlns=\"[http://www.softur.com.ar/wsbridge/budget.xsd]{.underline}\"\>2012-09-01\</InDate\>
> \<OutDate\
> xmlns=\"[http://www.softur.com.ar/wsbridge/budget.xsd]{.underline}\"\>2012-09-07\</OutDate\>
> \<BackOfficeOperator Code=\"000125\"\
> xmlns=\"[http://www.softur.com.ar/wsbridge/budget.xsd]{.underline}\"\>NEXT
> TRAVEL-\
> BUSINESS\</BackOfficeOperator\>\
> \<Class\
> xmlns=\"[http://www.softur.com.ar/wsbridge/budget.xsd]{.underline}\"\>DELUXE\</Class\>\
> \<FareTypeList Currency=\"USD\"\
> xmlns=\"[http://www.softur.com.ar/wsbridge/budget.xsd]{.underline}\"\>\
> \<Fare Type=\"DWL\"Paxs=\"2\"\>\
> \<CostAmount\>1043.18\</CostAmount\>
>
> \<WithoutTaxAmount\>0.00\</WithoutTaxAmount\>\
> \<TuristTaxAmount\>10.00\</TuristTaxAmount\>\
> \<FareAmount\>1303.98\</FareAmount\>\
> \<FareWithoutTaxAmount\>54.77\</FareWithoutTaxAmount\>
> \<FareTuristTaxAmount\>10.00\</FareTuristTaxAmount\>\
> \<FiscalTaxesList\>\
> \<FiscalTaxes Type=\"GRAVADO\"\>\
> \<Base\>0.00\</Base\>\
> \<Amount\>0.00\</Amount\>\
> \<Rate\>21.00\</Rate\>\
> \<FareBase\>260.80\</FareBase\>\
> \<FareAmount\>54.77\</FareAmount\>\
> \</FiscalTaxes\>\
> \<FiscalTaxes Type=\"NOGRAVADO\"\>\
> \<Base\>1043.18\</Base\>\
> \<Amount\>0.00\</Amount\>\
> \<Rate\>0.00\</Rate\>\
> \<FareBase\>1043.18\</FareBase\>\
> \<FareAmount\>0.00\</FareAmount\>\
> \</FiscalTaxes\>\
> \<FiscalTaxes Type=\"EXENTO\"\>\
> \<Base\>10.00\</Base\>\
> \<Amount\>0.00\</Amount\>\
> \<Rate\>0.00\</Rate\>\
> \<FareBase\>10.00\</FareBase\>\
> \<FareAmount\>0.00\</FareAmount\>\
> \</FiscalTaxes\>\
> \<FiscalTaxes Type=\"GRAV_AEREO\"\>\
> \<Base\>0.00\</Base\>\
> \<Amount\>0.00\</Amount\>\
> \<Rate\>10.50\</Rate\>\
> \<FareBase\>0.00\</FareBase\>\
> \<FareAmount\>0.00\</FareAmount\>\
> \</FiscalTaxes\>\
> \</FiscalTaxesList\>\
> \</Fare\>\
> \</FareTypeList\>\
> \<Comment\
> xmlns=\"[http://www.softur.com.ar/wsbridge/budget.xsd]{.underline}\"\>Equipaje
> Max 50\
> Kgs.\</Comment\>\
> \<PaymentType\
> xmlns=\"[http://www.softur.com.ar/wsbridge/budget.xsd]{.underline}\"\>CREDITCARD\</PaymentType\>
> \<CodPnrBroker\
> xmlns=\"[http://www.softur.com.ar/wsbridge/budget.xsd]{.underline}\"\>0YH012FG\</CodPnrBroker\>
> \</EventBudget\>\
> \</rq\>\
> \</AddEventRQ\>
>
> **6.16.2.Response**
>
> \<AddEventRS
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.wsdl\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<EventBudget xmlns=\"\"\>\
> \<FareId\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>00000123107\</FareId\>
> \<InDate
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>2012-09-01\</InDate\>\
> \<OutDate
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>2012-09-07\</OutDate\>\
> \<SubTotalAmount\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>1303.98\</SubTotalAmount\>
> \<FareTypeSelectionList\
> xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\"\>
>
> \<FareTypeSelection type=\"DWL\"\>2\</FareTypeSelection\>
> \</FareTypeSelectionList\>\
> \</EventBudget\>\
> \</AddEventRS\>
>
> **6.16.3.Observaciones**
>
> Con este FareId que devuelve, se envía un ítem EventBudget en el
> makeBudget:
>
> \<BudgetType1\>\
> \<pos\>\
> \<id\>WSGARBA\</id\>\
> \<clave\>WSGARBA\</clave\>\
> \</pos\>\
> \<rq UniqueId=\"\"\>\
> \<EventBudget ItemId=\"001\"\>\
> \<FareId\>00009000145\</FareId\>\
> \<InDate\>2012-09-01\</InDate\>\
> \<OutDate\>2012-09-07\</OutDate\>\
> \<SubTotalAmount\>1303.98\</SubTotalAmount\>\
> \<FareTypeSelectionList\>\
> \<FareTypeSelection type=\"DWL\"\>2\</FareTypeSelection\>
> \</FareTypeSelectionList\>\
> \</EventBudget\>\
> \<Summary CreationDate=\"2012-03-29T12:47:22.255Z\"\
> ModificationDate=\"2011-07-12T12:47:22.255Z\"StartDate=\"2011-07-12\"
> User=\"4787-7090\"Reference=\"hoteles\"Status=\"0\"Comments=\"\"Agent=\"00734\"
> Currency=\"USD\"\>\
> \</Summary\>\
> \</rq\>\
> \</BudgetType1\>
>
> **6.17. [makeBudget ]{.underline}**\
> **6.17.1.Request**
>
> \<BudgetType1 xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<pos xmlns=\"\"\>\
> \<id\>testeo\</id\>\
> \<clave\>testeo\</clave\>\
> \</pos\>\
> \<rq UniqueId=\"\"xmlns=\"\"\>\
> \<HotelBudget ItemId=\"001\"\>\
> \<FareId\>GT\|ROM-SIL-H\</FareId\>\
> \<InDate\>2010-11-30\</InDate\>\
> \<OutDate\>2010-12-03\</OutDate\>\
> \<SubTotalAmount\>1219.14\</SubTotalAmount\>\
> \<FareTypeSelectionList\>\
> \<FareTypeSelection
> type=\"SGL\"FareIdBroker=\"GT\|ROM-SIL-H\|TS\|001:SIL\"OccupancyId=\"1\"\>1\</FareTypeSelection\>\
> \<FareTypeSelection
> type=\"SGL\"FareIdBroker=\"GT\|ROM-SIL-H\|TS\|001:SIL\"OccupancyId=\"2\"\>1\</FareTypeSelection\>\
> \<Ocuppancy OccupancyId=\"1\"\>\
> \<Occupants type=\"ADT\"/\>\
> \</Ocuppancy\>\
> \<Ocuppancy OccupancyId=\"2\"\>\
> \<Occupants type=\"ADT\"/\>\
> \</Ocuppancy\>\
> \</FareTypeSelectionList\>\
> \</HotelBudget\>\
> \<Summary CreationDate=\"2010-09-04T12:47:22.255Z\"\
> ModificationDate=\"2010-09-04T12:47:22.255Z\"StartDate=\"2010-11-30\"
>
> User=\"test\"Reference=\"HOTEL Nueva Interfaz Grab.\"Status=\"0\"\
> Comments=\"Comentario Hotel Nueva
> Interfaz\"Agent=\"00734\"Currency=\"USD\"/\> \</rq\>\
> \</BudgetType1\>
>
> **6.17.2.Response**
>
> \<BudgetType2 xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<rs UniqueId=\"00020033956\"xmlns=\"\"\>\
> \<HotelBudget ItemId=\"001\"\>\
> \<FareId\>EV00020002513\</FareId\>\
> \<InDate\>2010-11-30\</InDate\>\
> \<OutDate\>2010-12-03\</OutDate\>\
> \<SubTotalAmount\>390.000\</SubTotalAmount\>\
> \<FareTypeSelectionList\>\
> \<FareTypeSelection type=\"doble de uso individual Estándar /Desayuno
> incluido\"OccupancyId=\"1\"\>1\</FareTypeSelection\>\
> \<FareTypeSelection type=\"doble de uso individual Estándar /Desayuno
> incluido\"OccupancyId=\"2\"\>1\</FareTypeSelection\>\
> \<Ocuppancy OccupancyId=\"1\"\>\
> \<Occupants type=\"ADT\"/\>\
> \</Ocuppancy\>\
> \<Ocuppancy OccupancyId=\"2\"\>\
> \<Occupants type=\"ADT\"/\>\
> \</Ocuppancy\>\
> \</FareTypeSelectionList\>\
> \</HotelBudget\>\
> \<Summary CreationDate=\"2010-09-04T12:47:22.255Z\"\
> ModificationDate=\"2010-09-04T12:47:22.255Z\"StartDate=\"2010-11-30\"\
> User=\"test\"Reference=\"HOTEL Nueva Interfaz Grab.\"Status=\"0\"\
> Comments=\"Comentario Hotel Nueva
> Interfaz\"Agent=\"00734\"Currency=\"USD\"/\> \</rs\>\
> \</BudgetType2\>
>
> **6.17.3.Observaciones**
>
> **6.18. [convertToBooking ]{.underline}**\
> **6.18.1.Request**
>
> \<CvtBookingRQ xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.wsdl\"\>\
> \<pos xmlns=\"\"\>\
> \<id\>testeo\</id\>\
> \<clave\>testeo\</clave\>\
> \</pos\>\
> \<rq xmlns=\"\"\>\
> \<idBudget\>00020033956\</idBudget\>\
> \<paxList\>\
> \<pax\>\
> \<ServiceRef\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>\
> \<ItemBooking OccupancyId=\"2\"\
> RoomId=\"2\"\>001\</ItemBooking\>\
> \</ServiceRef\>\
> \<Id\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>
>
> \<LastName\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>garcia\</LastName\>
> \<FirstName\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>laura\</FirstName\>
> \<InvoicingCustomer\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>00734\</InvoicingCustome
> r\>\
> \<Nationality\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>ARG\</Nationality\>
> \<DocType\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>Pasaporte\</DocType\>
> \<DocNumber\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>00\</DocNumber\>\
> \<Sex\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>F\</Sex\>\
> \<BirthDate\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>1986-03-22\</BirthDate\>
> \<PassportExpiration\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>2012-04-\
> 04\</PassportExpiration\>\
> \<DateFrom\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>2010-04-04\</DateFrom\>
> \<VisaDateOfIssue\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>04/04/10\</VisaDateOfIss
> ue\>\
> \<PassengerType\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>ADT\</PassengerType\>
> \</pax\>\
> \<pax\>\
> \<ServiceRef\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>\
> \<ItemBooking OccupancyId=\"1\"\
> RoomId=\"1\"\>001\</ItemBooking\>\
> \</ServiceRef\>\
> \<Id\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<LastName\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>gomez\</LastName\>
> \<FirstName\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>marta\</FirstName\>
> \<InvoicingCustomer\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>00734\</InvoicingCustome
> r\>\
> \<Nationality\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>ARG\</Nationality\>
> \<DocType\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>Pasaporte\</DocType\>
> \<DocNumber\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>00\</DocNumber\>\
> \<Sex\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>F\</Sex\>\
> \<BirthDate\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>1984-03-26\</BirthDate\>
> \<PassportExpiration\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>2012-04-\
> 04\</PassportExpiration\>\
> \<DateFrom\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>2010-04-04\</DateFrom\>
> \<VisaDateOfIssue\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>04/04/10\</VisaDateOfIss
> ue\>\
> \<PassengerType\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>ADT\</PassengerType\>
> \</pax\>\
> \</paxList\>\
> \</rq\>
>
> \</CvtBookingRQ\>
>
> **6.18.2.Response**
>
> \<CvtBookingRS xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto\>5381416\</texto\>\
> \</resultado\>\
> \<rs UniqueId=\"00020138172\"xmlns=\"\"/\>\
> \</CvtBookingRS\>
>
> **6.18.3.Observaciones**
>
> **6.19. [addBookingComment ]{.underline}**\
> **6.19.1.Request**
>
> \<AddBookingCommentRQ
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<pos xmlns=\"\"\>\
> \<id\>testeo\</id\>\
> \<clave\>testeo\</clave\>\
> \</pos\>\
> \<rq xmlns=\"\"\>\
> \<idBooking\>00020136851\</idBooking\>\
> \<comment\>\
> \<ServiceRef\>001\</ServiceRef\>\
> \<Text\> test \</Text\>\
> \<Value\>1\</Value\>\
> \<Read\>false\</Read\>\
> \</comment\>\
> \</rq\>\
> \</AddBookingCommentRQ\>
>
> **6.19.2.Response**
>
> \<AddBookingCommentRS
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<id xmlns=\"\"\>00020141232\</id\>\
> \</AddBookingCommentRS\>
>
> **6.19.3.Observaciones**
>
> **6.20. [ackBookingComment ]{.underline}**\
> **6.20.1.Request**
>
> \<AckBookingCommentRQ
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<pos xmlns=\"\"\>\
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<rq xmlns=\"\"\>\
> \<idBooking\>00020135377\</idBooking\>\
> \<idComment\>00020140222\</idComment\>
>
> \</rq\>\
> \</AckBookingCommentRQ\>
>
> **6.20.2.Response**
>
> \<AckBookingCommentRS
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \</AckBookingCommentRS\>
>
> **6.20.3.Observaciones**
>
> **6.21. [addBookingPassenger ]{.underline}**\
> **6.21.1.Request**
>
> \<AddBookingPassengerRQ
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.wsdl\"\>\
> \<pos xmlns=\"\"\>\
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<rq xmlns=\"\"\>\
> \<idBooking\>00020131914\</idBooking\>\
> \<passenger\>\
> \<CommentRef\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<LastName\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>rcruz\</LastName\>
> \<FirstName\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>prueba\</FirstName\>
> \<MiddleName\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>prueba\</MiddleName\>
> \<InvoicingCustomer\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>00734\</InvoicingCustome
> r\>\
> \<Address\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<Town xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\" /\>\
> \<ZipCode\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<City xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\" /\>\
> \<Nationality\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>ARG\</Nationality\>
> \<DocType\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>Pasaporte\</DocType\>
> \<DocNumber\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>ddd\</DocNumber\>\
> \<Occupation\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<Role xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\" /\>\
> \<Company\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<Sex\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>F\</Sex\>\
> \<BirthDate\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>1972-01-14\</BirthDate\>
>
> \<PassportExpiration\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>2010-07-\
> 29\</PassportExpiration\>\
> \<DateFrom\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>2010-07-29\</DateFrom\>
> \<VisaDateOfIssue\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>29/07/10\</VisaDateOfIss
> ue\>\
> \<PassengerType\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>ADT\</PassengerType\>
> \</passenger\>\
> \</rq\>\
> \</AddBookingPassengerRQ\>
>
> **6.21.2.Response**
>
> \<AddBookingPassengerRS
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.wsdl\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<id xmlns=\"\"\>00020242090\</id\>\
> \</AddBookingPassengerRS\>
>
> **6.21.3.Observaciones**
>
> **6.22. [modBookingPassenger ]{.underline}**\
> **6.22.1.Request**
>
> \<ModBookingPassengerRQ
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.wsdl\"\>\
> \<pos xmlns=\"\"\>\
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<rq xmlns=\"\"\>\
> \<idBooking\>00020133556\</idBooking\>\
> \<passenger\>\
> \<ServiceRef\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<CommentRef\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<TransportInfoRef\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<Id\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>00020320960\</Id\>
> \<LastName\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>DENIER\</LastName\>
> \<FirstName\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>PAOLA\</FirstName\>
> \<MiddleName\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<InvoicingCustomer\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>05616\</InvoicingCustome
> r\>\
> \<Address\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<Town xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\" /\>
>
> \<ZipCode\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<City xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\" /\>\
> \<Nationality\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>ARG\</Nationality\>
> \<DocType\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>Pasaporte\</DocType\>
> \<DocNumber\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>0\</DocNumber\>\
> \<Occupation\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<Role xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\" /\>\
> \<Company\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>\
> \<Sex\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>F\</Sex\>\
> \<BirthDate\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>1973-02-02\</BirthDate\>
> \<PassportExpiration\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>2010-08-\
> 06\</PassportExpiration\>\
> \<DateFrom\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>2010-08-06\</DateFrom\>
> \<VisaDateOfIssue\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>06/08/10\</VisaDateOfIss
> ue\>\
> \<PassengerType\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>ADT\</PassengerType\>
> \<Attributes\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>\
> \<Code\>\
> \</Code\>\
> \<Description\>\
> \</Description\>\
> \<Value\>\
> \</Value\>\
> \</Attributes\>\
> \</passenger\>\
> \</rq\>\
> \</ModBookingPassengerRQ\>
>
> **6.22.2.Response**
>
> \<ModBookingPassengerRS
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \</ModBookingPassengerRS\>
>
> **6.22.3.Observaciones**
>
> **6.23. [delBookingPassenger ]{.underline}**\
> **6.23.1.Request**
>
> \<DelBookingPassengerRQ
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<pos xmlns=\"\"\>\
> \<id\>testeo\</id\>
>
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<rq xmlns=\"\"\>\
> \<idBooking\>00020131955\</idBooking\>
> \<idPassenger\>00020317235\</idPassenger\> \</rq\>\
> \</DelBookingPassengerRQ\>
>
> **6.23.2.Response**
>
> \<DelBookingPassengerRS
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
> xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \</DelBookingPassengerRS\>
>
> **6.23.3.Observaciones**
>
> **6.24. [addBookingTransportInfo ]{.underline}**\
> **6.24.1.Request**
>
> \<AddBookingTransportInfoRQ
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.wsdl\"\>\
> \<pos xmlns=\"\"\>\
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<rq xmlns=\"\"\>\
> \<idBooking\>00020095917\</idBooking\>\
> \<transportInfo\>\
> \<Id xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"/\>
> \<ServiceRef\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>002\</ServiceRef\>
> \<AirInfo xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>
> \<FlightNumber\>AA2105\</FlightNumber\>\
> \<Origin\>MIA\</Origin\>\
> \<Destination\>CUN\</Destination\>\
> \<Class /\>\
> \<Departure\>2009-10-15T18:40:00\</Departure\>\
> \<Arrival\>2009-10-15T19:20:00\</Arrival\>\
> \<Status /\>\
> \<PNR /\>\
> \<TimeLimit\>2009-10-15\</TimeLimit\>\
> \</AirInfo\>\
> \</transportInfo\>\
> \</rq\>\
> \</AddBookingTransportInfoRQ\>
>
> **6.24.2.Response**
>
> \<AddBookingTransportInfoRS
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.wsdl\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<id xmlns=\"\"\>00020236248\</id\>
>
> \</AddBookingTransportInfoRS\>
>
> **6.24.3.Observaciones**
>
> **6.25. [modBookingTransportInfo ]{.underline}**\
> **6.25.1.Request**
>
> \<ModBookingTransportInfoRQ
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.wsdl\"\>\
> \<pos xmlns=\"\"\>\
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<rq xmlns=\"\"\>\
> \<idBooking\>00020095917\</idBooking\>\
> \<transportInfo\>\
> \<Id
> xmlns="[http://www.softur.com.ar/WSBridge/booking.xsd]{.underline}"
> \>00020236248\</Id\>\
> \<ServiceRef\
> xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>002\</ServiceRef\>
> \<AirInfo xmlns=\"http://www.softur.com.ar/WSBridge/booking.xsd\"\>
> \<FlightNumber\>AA2105\</FlightNumber\>\
> \<Origin\>MIA\</Origin\>\
> \<Destination\>CUN\</Destination\>\
> \<Class /\>\
> \<Departure\>2009-10-15T18:40:00\</Departure\>\
> \<Arrival\>2009-10-15T19:20:00\</Arrival\>\
> \<Status /\>\
> \<PNR /\>\
> \<TimeLimit\>2009-10-15\</TimeLimit\>\
> \</AirInfo\>\
> \</transportInfo\>\
> \</rq\>\
> \</ModBookingTransportInfoRQ\>
>
> **6.25.2.Response**
>
> \<ModBookingTransportInfoRS
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\
> xmlns=\"http://www.softur.com.ar/WSBridge/budget.wsdl\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \<id xmlns=\"\"\>00020236248\</id\>\
> \</ModBookingTransportInfoRS\>
>
> **6.25.3.Observaciones**
>
> **6.26. [delBookingTransportInfo ]{.underline}**\
> **6.26.1.Request**
>
> \<DelBookingTransportInfoRQ
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<pos xmlns=\"\"\>
>
> \<id\>testeo\</id\>\
> \<clave\>testeows\</clave\>\
> \</pos\>\
> \<rq xmlns=\"\"\>\
> \<idBooking\>00020131955\</idBooking\>\
> \<idTransportInfo\>00020317235\</idTransportInfo\> \</rq\>\
> \</DelBookingTransportInfoRQ\>
>
> **6.26.2.Response**
>
> \<DelBookingTransportInfoRS
> xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\>\
> \<resultado xmlns=\"\"\>\
> \<codigo\>0\</codigo\>\
> \<texto /\>\
> \</resultado\>\
> \</DelBookingTransportInfoRS\>
>
> **6.26.3.Observaciones**
>
> **7. PROCESO DE CERTIFICACION WEB SERVICE BRIDGE XML**
>
> El proceso de certificación consta de 3 pasos:
>
> 1\. Nos aseguramos de que el sitio será la confirmación de plazas
> adecuado. Por adecuada nosreferimos, precios justos, así como el
> número de habitaciones, fechas, hoteles, tipo de placa, el tipo
> dehabitación\... Los clientes deben ser también conscientes de lo que
> nos exigen los hoteleros paramostrarlos. En este paso usted debe
> proporcionarnos un enlace a su sitio beta para hacer algunasreservas
> de prueba. Prestamos especial atención a:
>
> 1.1. Las edades de los niños deben plantearse en la página de búsqueda
> y no se puede cambiar durante el resto del proceso de reserva.
>
> 1.2. El contrato de observaciones debe ser indicado en el resumen del
> presupuesto antes de confirmalo a reserva y también en el bono. Esta
> es una información crítica a través de el hotelero para el cliente y
> debe ser indicada junto con la información de las habitaciones. La
> información se proporciona a través MakeBudget y ConvertToBooking. La
> mayoría de las prestaciones tienen observaciones referidas a temas
> contractuales.
>
> 1.3. En el comprobante de la información de proveedores tales como
> nombre del proveedor y del IVA deberá indicarse (\"pagar a través de
> \...\"). BridgeWebService referencia de reserva tiene que ser
> resaltado. Los nombres de los clientes (por lo menos uno por
> habitación), los niños, el destino, check in / fechas a cabo, tipo de
> habitación, tipo de tabla, los detalles del hotel (dirección, teléfono
> y categoría). Para obtener un ejemplo, por favor voucher.doc cheque.
>
> 1.4. Aunque no es obligatorio, también recomendamos que muestra antes
> de confirmar las condiciones de cancelación y las cuestiones del
> hotel. Viendo esta información evitará que otras cuestiones con los
> clientes.
>
> 2\. Una vez que estamos seguros de los clientes estén bien informados,
> se analiza la estructura de las peticiones XML. Para hacer esta
> prueba, usted tendrá que realizar algunas peticiones con parámetrosque
> le proporcionaríamos para que podamos analizar su código.
>
> 3\. En este punto, usted ya estará Online. Sin embargo, con el fin de
> permanecer en LIVE que tendrá queconfirmar una reserva (fechas de seis
> meses de antelación) y enviar a los dos bono y el precio. Tener
> encuenta que usted tendrá que cancelar la reserva después, de lo
> contrario se generaran cargos. Consultecon nosotros antes de cancelar.
>
> **FORMULARIO DE INTEGRACION**

+-------+-------+-------+-------+-------+-------+-------+-------+-------+
| **    |       |       |       |       |       |       |       |       |
| DATOS |       |       |       |       |       |       |       |       |
| EM    |       |       |       |       |       |       |       |       |
| PRESA |       |       |       |       |       |       |       |       |
| DE    |       |       |       |       |       |       |       |       |
| TURI  |       |       |       |       |       |       |       |       |
| SMO** |       |       |       |       |       |       |       |       |
+=======+=======+=======+=======+=======+=======+=======+=======+=======+
| >     |       |       |       |       |       | > CU  |       |       |
| Razón |       |       |       |       |       | IT/RU |       |       |
| > So  |       |       |       |       |       | T/RUC |       |       |
| cial: |       |       |       |       |       | /NIT: |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+-------+
| >     |       |       |       |       |       |       |       | > Ba  |
| Direc |       |       |       |       |       |       |       | rrio: |
| ción: |       |       |       |       |       |       |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+-------+
| > Ci  | > Dep |       | > C   |       |       | >     |       |       |
| udad: | artam |       | ódigo |       |       | País: |       |       |
|       | ento: |       | > Po  |       |       |       |       |       |
|       |       |       | stal: |       |       |       |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+-------+
| >     |       | > Seg |       |       | >     |       |       |       |
| IATA: |       | mento |       |       | Sitio |       |       |       |
|       |       | > de  |       |       | >     |       |       |       |
|       |       | > Mer |       |       |  Web: |       |       |       |
|       |       | cado: |       |       |       |       |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+-------+
| > R   |       |       |       | >     |       |       |       |       |
| espon |       |       |       |  Telé |       |       |       |       |
| sáble |       |       |       | fono: |       |       |       |       |
| >     |       |       |       |       |       |       |       |       |
| Comer |       |       |       |       |       |       |       |       |
| cial: |       |       |       |       |       |       |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+-------+
| > E-  |       |       |       |       |       |       | > Tel |       |
| mail: |       |       |       |       |       |       | éfono |       |
|       |       |       |       |       |       |       | > M   |       |
|       |       |       |       |       |       |       | óvil: |       |
+-------+-------+-------+-------+-------+-------+-------+-------+-------+

+-----------------------------------+-----------------------------------+
| **TIPO DE DESARROLLO**            |                                   |
+===================================+===================================+
| > ( ) Desarrollo propio           | > ( ) Comprar una solución        |
|                                   | > estándar, disponible en el      |
|                                   | > mercado                         |
+-----------------------------------+-----------------------------------+

+-----------------------+-----------------------+-----------------------+
| **DATOS LIDER         |                       |                       |
| PROYECTO EN EMPRESA   |                       |                       |
| DE TURISMO**          |                       |                       |
+=======================+=======================+=======================+
| > DNI/CI              | > NRO DE IP ACCESO    |                       |
+-----------------------+-----------------------+-----------------------+
| > Primer Nombre:      |                       | > Apelido:            |
+-----------------------+-----------------------+-----------------------+

+-----------------------------------+-----------------------------------+
| **DATOS EMPRESA RESPONSABLE DEL   |                                   |
| DESARROLLO**                      |                                   |
+===================================+===================================+
| > Nombre da Empresa:              |                                   |
+-----------------------------------+-----------------------------------+
| > Responsable:                    | > E-mail:                         |
+-----------------------------------+-----------------------------------+

+-----------------------+-----------------------+-----------------------+
| **EJECUTIVO           |                       |                       |
| COMERCIAL**           |                       |                       |
+=======================+=======================+=======================+
| > Nombre:             | > Teléfono:           |                       |
+-----------------------+-----------------------+-----------------------+
| > E-mail:             |                       | > Teléfono Móvil:     |
+-----------------------+-----------------------+-----------------------+

  -----------------------------------------------------------------------
  **DESCRICIÓN DEL MODELO DE NEGÓCIO / JUSTIFICACION**
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **ETAPAS DE INTEGRACION**                                             |
+=======================================================================+
| > a)Envio del presente documento completo y firmado (en formato       |
| > digigal escaneado)\                                                 |
| > b)Recepcion de datos acceso entorno de testing (test) junto a       |
| > documentacion y esquema de utilizacion de web services. c)Para      |
| > acceder al entorno de produccion (live) es necesario completar un   |
| > proceso de certificación donde se evaluara el correcto uso del web  |
| > service, esto puede implicar sugirir ajustes en su utilizacion.     |
| >                                                                     |
| > d)Certificacion.                                                    |
| >                                                                     |
| > e)Recepcion de datos de acceso a entorno producción.                |
+-----------------------------------------------------------------------+

**SOFTUR S.A.**

Departamento de Desarrollo
